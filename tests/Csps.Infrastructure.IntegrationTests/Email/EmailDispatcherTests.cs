using System.Collections.Concurrent;
using System.Net.Sockets;
using Csps.Application.Email;
using Csps.Infrastructure.Email;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using MailKit;
using MailKit.Net.Smtp;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Email;

/// <summary>
/// D-33, AUTH-13, CWE-532: a failed send is retried on the fixed schedule for about 10 minutes and then closed, an
/// expired row is never sent, two dispatchers never send one row twice, and no log line carries a secret.
/// </summary>
public sealed class EmailDispatcherTests(CspsDatabase database) : IClassFixture<CspsDatabase>, IAsyncLifetime
{
    private const string Code = "048213";
    private const string Token = "reset-token-9f3a";
    private const string Subject = "048213 is your CSPS sign-in code";
    private const string SmtpSecret = "SMTP-PASSWORD-hunter2";

    private static readonly DateTimeOffset Start = new(2026, 10, 14, 7, 42, 0, TimeSpan.Zero);
    private static readonly TimeSpan[] Delays =
        [TimeSpan.FromSeconds(30), TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(2), TimeSpan.FromMinutes(4), TimeSpan.FromSeconds(150)];

    // One ephemeral key ring per test, shared by the queued rows and the dispatchers.
    private readonly EphemeralDataProtectionProvider _protection = new();

    private IDataProtector Protector => _protection.CreateProtector(OutboxEmailSender.ProtectionPurpose);

    public ValueTask InitializeAsync() => ValueTask.CompletedTask;

    public async ValueTask DisposeAsync() => await database.ResetAsync();

    [Fact]
    public async Task AFailedSendIsRetriedOnTheFixedScheduleThenClosedAndScrubbed()
    {
        var time = new FakeTimeProvider(Start);
        var transport = new ScriptedTransport(() => new SocketException());
        var dispatcher = CreateDispatcher(time, transport, out _);
        var to = await QueueAsync(time.GetUtcNow(), Start.AddHours(1));

        for (var attempt = 0; attempt < Delays.Length; attempt++)
        {
            await dispatcher.SweepAsync(TestContext.Current.CancellationToken);

            transport.Calls.ShouldBe(attempt + 1);
            var row = await ReadAsync(to);
            row.Attempts.ShouldBe(attempt + 1);
            row.FailedAt.ShouldBeNull();
            row.LastErrorCode.ShouldBe("smtp-connect");
            row.NextAttemptAt.ShouldBe(time.GetUtcNow() + Delays[attempt]);
            row.ProtectedSubject.ShouldNotBeNull();

            time.Advance(Delays[attempt] - TimeSpan.FromSeconds(1));
            await dispatcher.SweepAsync(TestContext.Current.CancellationToken);
            transport.Calls.ShouldBe(attempt + 1);

            time.Advance(TimeSpan.FromSeconds(1));
        }

        await dispatcher.SweepAsync(TestContext.Current.CancellationToken);

        transport.Calls.ShouldBe(Delays.Length + 1);
        var closed = await ReadAsync(to);
        closed.FailedAt.ShouldBe(time.GetUtcNow());
        closed.SentAt.ShouldBeNull();
        closed.Attempts.ShouldBe(Delays.Length + 1);
        closed.LastErrorCode.ShouldBe("smtp-connect");
        closed.ProtectedSubject.ShouldBeNull();
        closed.ProtectedText.ShouldBeNull();
        closed.ProtectedHtml.ShouldBeNull();

        time.Advance(TimeSpan.FromDays(1));
        await dispatcher.SweepAsync(TestContext.Current.CancellationToken);
        transport.Calls.ShouldBe(Delays.Length + 1);
    }

    [Fact]
    public async Task ARowThatRecoversIsSentOnceAndScrubbed()
    {
        var time = new FakeTimeProvider(Start);
        var calls = 0;
        var transport = new ScriptedTransport(() => calls++ == 0 ? new SocketException() : null);
        var dispatcher = CreateDispatcher(time, transport, out _);
        var to = await QueueAsync(time.GetUtcNow(), Start.AddHours(1));

        await dispatcher.SweepAsync(TestContext.Current.CancellationToken);
        time.Advance(TimeSpan.FromSeconds(30));
        await dispatcher.SweepAsync(TestContext.Current.CancellationToken);
        time.Advance(TimeSpan.FromHours(1));
        await dispatcher.SweepAsync(TestContext.Current.CancellationToken);

        transport.Sent.Count(email => email.To == to).ShouldBe(1);
        var row = await ReadAsync(to);
        row.SentAt.ShouldNotBeNull();
        row.LastErrorCode.ShouldBeNull();
        row.ProtectedSubject.ShouldBeNull();
    }

    [Fact]
    public async Task ARowPastItsNotAfterIsClosedUnsentAndScrubbed()
    {
        var time = new FakeTimeProvider(Start);
        var transport = new ScriptedTransport(() => null);
        var dispatcher = CreateDispatcher(time, transport, out _);
        var to = await QueueAsync(time.GetUtcNow(), Start.AddMinutes(5));

        time.Advance(TimeSpan.FromMinutes(6));
        await dispatcher.SweepAsync(TestContext.Current.CancellationToken);

        transport.Calls.ShouldBe(0);
        var row = await ReadAsync(to);
        row.ExpiredAt.ShouldBe(time.GetUtcNow());
        row.SentAt.ShouldBeNull();
        row.FailedAt.ShouldBeNull();
        row.ProtectedSubject.ShouldBeNull();
        row.ProtectedText.ShouldBeNull();
        row.ProtectedHtml.ShouldBeNull();
    }

    [Fact]
    public async Task ARowExpiresBetweenRetriesWithoutAnotherSend()
    {
        var time = new FakeTimeProvider(Start);
        var transport = new ScriptedTransport(() => new SocketException());
        var dispatcher = CreateDispatcher(time, transport, out _);
        var to = await QueueAsync(time.GetUtcNow(), Start.AddSeconds(45));

        await dispatcher.SweepAsync(TestContext.Current.CancellationToken);
        time.Advance(TimeSpan.FromMinutes(1));
        await dispatcher.SweepAsync(TestContext.Current.CancellationToken);

        transport.Calls.ShouldBe(1);
        (await ReadAsync(to)).ExpiredAt.ShouldNotBeNull();
    }

    [Fact]
    public async Task ARowAnotherDispatcherHasClaimedIsNotSentAgain()
    {
        var time = new FakeTimeProvider(Start);
        EmailDispatcher? second = null;
        var transport = new ScriptedTransport(() => null)
        {
            // While the first dispatcher is sending, the second sweeps: the claim hides the row from it.
            OnSend = () => second!.SweepAsync(TestContext.Current.CancellationToken),
        };
        var first = CreateDispatcher(time, transport, out _);
        second = CreateDispatcher(time, transport, out _);
        var to = await QueueAsync(time.GetUtcNow(), Start.AddHours(1));

        await first.SweepAsync(TestContext.Current.CancellationToken);

        transport.Sent.Count(email => email.To == to).ShouldBe(1);
        (await ReadAsync(to)).SentAt.ShouldNotBeNull();
    }

    [Fact]
    public async Task TwoDispatchersSweepingTogetherSendEveryRowExactlyOnce()
    {
        var time = new FakeTimeProvider(Start);
        var transport = new ScriptedTransport(() => null) { Delay = TimeSpan.FromMilliseconds(15) };
        var first = CreateDispatcher(time, transport, out _);
        var second = CreateDispatcher(time, transport, out _);
        var addresses = new List<string>();
        for (var index = 0; index < 20; index++)
        {
            addresses.Add(await QueueAsync(time.GetUtcNow(), Start.AddHours(1)));
        }

        await Task.WhenAll(
            first.SweepAsync(TestContext.Current.CancellationToken),
            second.SweepAsync(TestContext.Current.CancellationToken));

        foreach (var to in addresses)
        {
            transport.Sent.Count(email => email.To == to).ShouldBe(1);
            (await ReadAsync(to)).SentAt.ShouldNotBeNull();
        }
    }

    [Theory]
    [MemberData(nameof(ErrorCases))]
    public async Task TransportFailuresAreStoredAsShortCodesNeverMessages(Func<Exception> failure, string code)
    {
        var time = new FakeTimeProvider(Start);
        var transport = new ScriptedTransport(failure);
        var dispatcher = CreateDispatcher(time, transport, out _);
        var to = await QueueAsync(time.GetUtcNow(), Start.AddHours(1));

        await dispatcher.SweepAsync(TestContext.Current.CancellationToken);

        (await ReadAsync(to)).LastErrorCode.ShouldBe(code);
    }

    public static TheoryData<Func<Exception>, string> ErrorCases() => new()
    {
        { () => new SocketException(), "smtp-connect" },
        { () => new IOException(SmtpSecret), "smtp-connect" },
        { () => new MailKit.Security.AuthenticationException(SmtpSecret), "smtp-auth" },
        { () => new SmtpCommandException(SmtpErrorCode.MessageNotAccepted, SmtpStatusCode.MailboxUnavailable, SmtpSecret), "smtp-send" },
        { () => new InvalidOperationException(SmtpSecret), "unknown" },
    };

    [Fact]
    public async Task LogsCarryOnlyTheRowIdTheKindAndAShortCode()
    {
        var time = new FakeTimeProvider(Start);
        var transport = new ScriptedTransport(() => new InvalidOperationException($"{SmtpSecret} {Code} {Token}"));
        var dispatcher = CreateDispatcher(time, transport, out var logger);
        var expiring = await QueueAsync(time.GetUtcNow(), Start.AddSeconds(10));
        var failing = await QueueAsync(time.GetUtcNow(), Start.AddHours(1));
        time.Advance(TimeSpan.FromSeconds(20));

        for (var attempt = 0; attempt <= Delays.Length; attempt++)
        {
            await dispatcher.SweepAsync(TestContext.Current.CancellationToken);
            time.Advance(TimeSpan.FromMinutes(5));
        }

        var failedRow = await ReadAsync(failing);
        var records = logger.Collector.GetSnapshot();
        records.ShouldNotBeEmpty();
        records.ShouldContain(record => record.Level == LogLevel.Warning && record.Message.Contains(failedRow.Id.ToString(), StringComparison.Ordinal));
        records.ShouldContain(record => record.Message.Contains("SignInCode", StringComparison.Ordinal) && record.Message.Contains("unknown", StringComparison.Ordinal));
        foreach (var record in records)
        {
            record.Exception.ShouldBeNull();
            foreach (var secret in new[] { expiring, failing, Code, Token, Subject, SmtpSecret, "Chrome", "https://" })
            {
                record.Message.ShouldNotContain(secret);
                foreach (var pair in record.StructuredState ?? [])
                {
                    (pair.Value ?? string.Empty).ShouldNotContain(secret);
                }
            }
        }
    }

    private async Task<string> QueueAsync(DateTimeOffset createdAt, DateTimeOffset notAfter)
    {
        var to = $"paolo.{Guid.NewGuid():N}@example.com";
        var context = database.CreateContext();
        await using (context)
        {
            context.EmailOutbox.Add(EmailOutboxMessage.Queue(
                Guid.CreateVersion7(createdAt),
                AuthEmailKind.SignInCode,
                to,
                Protector.Protect(Subject),
                Protector.Protect($"Your code is {Code}. Reset: https://localhost/admin/reset-password#token={Token}"),
                Protector.Protect($"<p>{Code}</p>"),
                createdAt,
                notAfter));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        return to;
    }

    private async Task<EmailOutboxMessage> ReadAsync(string to)
    {
        var context = database.CreateContext();
        await using (context)
        {
            return await context.EmailOutbox.AsNoTracking().SingleAsync(message => message.ToAddress == to, TestContext.Current.CancellationToken);
        }
    }

    private EmailDispatcher CreateDispatcher(FakeTimeProvider time, IEmailTransport transport, out FakeLogger<EmailDispatcher> logger)
    {
        logger = new FakeLogger<EmailDispatcher>();
        return new EmailDispatcher(
            new DatabaseContextFactory(database),
            _protection,
            transport,
            new OutboxSignal(),
            time,
            Options.Create(new EmailDispatcherOptions()),
            logger);
    }

    private sealed class DatabaseContextFactory(CspsDatabase database) : IDbContextFactory<CspsDbContext>
    {
        public CspsDbContext CreateDbContext() => database.CreateContext();
    }

    private sealed class ScriptedTransport(Func<Exception?> next) : IEmailTransport
    {
        private readonly ConcurrentQueue<OutgoingEmail> _sent = new();
        private int _calls;
        private int _hooked;

        public int Calls => Volatile.Read(ref _calls);

        public IReadOnlyCollection<OutgoingEmail> Sent => [.. _sent];

        public TimeSpan Delay { get; init; }

        public Func<Task>? OnSend { get; init; }

        public async Task SendAsync(OutgoingEmail email, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _calls);
            if (Delay > TimeSpan.Zero)
            {
                await Task.Delay(Delay, CancellationToken.None);
            }

            if (OnSend is not null && Interlocked.Exchange(ref _hooked, 1) == 0)
            {
                await OnSend();
            }

            var failure = next();
            if (failure is not null)
            {
                throw failure;
            }

            _sent.Enqueue(email);
        }
    }
}
