using System.Collections.Concurrent;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Identity;
using Csps.Infrastructure.Email;
using Csps.Infrastructure.IntegrationTests.Auditing;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace Csps.Infrastructure.IntegrationTests.Email;

/// <summary>
/// AUTH-13, D-08: a queued sign-in code email commits with the caller, reaches the transport only after the commit,
/// and leaves nothing readable in the outbox row. Each test queues mail for its own address, because the class shares
/// one database and every host's dispatcher sweeps all due rows.
/// </summary>
public sealed class EmailOutboxTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly TimeSpan Patience = TimeSpan.FromSeconds(5);

    [Fact]
    public async Task QueuedCodeEmailIsSentAfterTheCommitAndScrubbed()
    {
        var transport = new RecordingTransport();
        var to = NewAddress();
        using var host = await StartHostAsync(transport, dispatcherEnabled: true);

        await QueueCodeAsync(host, to);

        var sent = await transport.WaitForAsync(to, Patience);
        sent.Subject.ShouldBe("048213 is your CSPS sign-in code");
        sent.Text.ShouldContain("048213");
        sent.Html.ShouldContain("048213");

        var row = await ReadSentRowAsync(host, to);
        row.SentAt.ShouldNotBeNull();
        row.ProtectedSubject.ShouldBeNull();
        row.ProtectedText.ShouldBeNull();
        row.ProtectedHtml.ShouldBeNull();
        row.Kind.ShouldBe(AuthEmailKind.SignInCode);
    }

    [Fact]
    public async Task QueuedPasswordResetEmailReachesTheTransportWithASafeLinkAndIsScrubbed()
    {
        var transport = new RecordingTransport();
        var to = NewAddress();
        using var host = await StartHostAsync(transport, dispatcherEnabled: true);
        var now = TimeProvider.System.GetUtcNow();

        var scope = host.Services.CreateAsyncScope();
        await using (scope)
        {
            var email = new PasswordResetEmail(to, "tok-abc_123", now.AddMinutes(30), now, new DeviceDescription("Chrome on Android", true));
            await scope.ServiceProvider.GetRequiredService<IEmailOutbox>().EnqueueAsync(email, TestContext.Current.CancellationToken);
            await scope.ServiceProvider.GetRequiredService<IUnitOfWork>().SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var sent = await transport.WaitForAsync(to, Patience);
        sent.Subject.ShouldBe("Reset your CSPS password");
        sent.Text.ShouldContain("https://localhost/admin/reset-password#token=tok-abc_123");

        var row = await ReadSentRowAsync(host, to);
        row.Kind.ShouldBe(AuthEmailKind.PasswordReset);
        row.ProtectedSubject.ShouldBeNull();
        row.ProtectedText.ShouldBeNull();
        row.ProtectedHtml.ShouldBeNull();
    }

    [Fact]
    public async Task EnqueueWithoutACommitSendsNothingAndStoresNothing()
    {
        var transport = new RecordingTransport();
        var to = NewAddress();
        using var host = await StartHostAsync(transport, dispatcherEnabled: true);

        var scope = host.Services.CreateAsyncScope();
        await using (scope)
        {
            await scope.ServiceProvider.GetRequiredService<IEmailOutbox>().EnqueueAsync(CodeEmail(to), TestContext.Current.CancellationToken);
        }

        await Task.Delay(TimeSpan.FromSeconds(2.5), TestContext.Current.CancellationToken);

        transport.Messages(to).ShouldBeEmpty();
        (await FindRowsAsync(host, to)).ShouldBeEmpty();
    }

    [Fact]
    public async Task StoredContentIsCiphertextThatUnprotectsToTheMessage()
    {
        var transport = new RecordingTransport();
        var to = NewAddress();
        using var host = await StartHostAsync(transport, dispatcherEnabled: false);

        await QueueCodeAsync(host, to);

        var row = await ReadRowAsync(host, to);
        row.SentAt.ShouldBeNull();
        row.ProtectedSubject.ShouldNotBeNull().ShouldNotContain("048213");
        row.ProtectedText.ShouldNotBeNull().ShouldNotContain("048213");
        row.ProtectedHtml.ShouldNotBeNull().ShouldNotContain("048213");

        var protector = host.Services.GetRequiredService<IDataProtectionProvider>().CreateProtector(OutboxEmailSender.ProtectionPurpose);
        protector.Unprotect(row.ProtectedSubject).ShouldBe("048213 is your CSPS sign-in code");
        protector.Unprotect(row.ProtectedText).ShouldContain("048213");
        transport.Messages(to).ShouldBeEmpty();
    }

    [Fact]
    public async Task MailQueuedInATransactionIsSentOnlyAfterItCommits()
    {
        var transport = new RecordingTransport();
        var to = NewAddress();

        // An hour between sweeps: only the signal that follows the commit can make this send in time.
        using var host = await StartHostAsync(transport, dispatcherEnabled: true, sweepInterval: TimeSpan.FromHours(1));

        var scope = host.Services.CreateAsyncScope();
        await using (scope)
        {
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var outbox = scope.ServiceProvider.GetRequiredService<IEmailOutbox>();
            await unitOfWork.InTransactionAsync(
                async cancellationToken =>
                {
                    await outbox.EnqueueAsync(CodeEmail(to), cancellationToken);
                    await unitOfWork.SaveChangesAsync(cancellationToken);
                    await Task.Delay(TimeSpan.FromSeconds(1), cancellationToken);
                    transport.Messages(to).ShouldBeEmpty();
                    return 0;
                },
                TestContext.Current.CancellationToken);
        }

        (await transport.WaitForAsync(to, Patience)).Subject.ShouldBe("048213 is your CSPS sign-in code");
    }

    [Fact]
    public async Task MailQueuedInARolledBackTransactionIsNeverSent()
    {
        var transport = new RecordingTransport();
        var to = NewAddress();
        using var host = await StartHostAsync(transport, dispatcherEnabled: true);

        var scope = host.Services.CreateAsyncScope();
        await using (scope)
        {
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var outbox = scope.ServiceProvider.GetRequiredService<IEmailOutbox>();
            await Should.ThrowAsync<InvalidOperationException>(() => unitOfWork.InTransactionAsync<int>(
                async cancellationToken =>
                {
                    await outbox.EnqueueAsync(CodeEmail(to), cancellationToken);
                    await unitOfWork.SaveChangesAsync(cancellationToken);
                    throw new InvalidOperationException("The business change failed.");
                },
                TestContext.Current.CancellationToken));
        }

        await Task.Delay(TimeSpan.FromSeconds(2.5), TestContext.Current.CancellationToken);

        transport.Messages(to).ShouldBeEmpty();
        (await FindRowsAsync(host, to)).ShouldBeEmpty();
    }

    [Fact]
    public async Task RecentMailIsCountedByKindAddressAndTime()
    {
        var transport = new RecordingTransport();
        var to = NewAddress();
        using var host = await StartHostAsync(transport, dispatcherEnabled: false);
        await QueueCodeAsync(host, to);
        await QueueCodeAsync(host, to);
        await QueueCodeAsync(host, NewAddress());
        var now = TimeProvider.System.GetUtcNow();

        var scope = host.Services.CreateAsyncScope();
        await using (scope)
        {
            var outbox = scope.ServiceProvider.GetRequiredService<IEmailOutbox>();
            var token = TestContext.Current.CancellationToken;

            (await outbox.CountRecentAsync(AuthEmailKind.SignInCode, to, now.AddMinutes(-10), token)).ShouldBe(2);
            (await outbox.CountRecentAsync(AuthEmailKind.SignInCode, to.ToUpperInvariant(), now.AddMinutes(-10), token)).ShouldBe(2);
            (await outbox.CountRecentAsync(AuthEmailKind.Invite, to, now.AddMinutes(-10), token)).ShouldBe(0);
            (await outbox.CountRecentAsync(AuthEmailKind.SignInCode, to, now.AddMinutes(10), token)).ShouldBe(0);
        }
    }

    private static string NewAddress() => $"paolo.{Guid.NewGuid():N}@example.com";

    private static SignInCodeEmail CodeEmail(string to)
    {
        var now = TimeProvider.System.GetUtcNow();
        return new SignInCodeEmail(to, "048213", now.AddMinutes(15), now, new DeviceDescription("Chrome on Android", true));
    }

    private static async Task QueueCodeAsync(IHost host, string to)
    {
        var scope = host.Services.CreateAsyncScope();
        await using (scope)
        {
            await scope.ServiceProvider.GetRequiredService<IEmailOutbox>().EnqueueAsync(CodeEmail(to), TestContext.Current.CancellationToken);
            await scope.ServiceProvider.GetRequiredService<IUnitOfWork>().SaveChangesAsync(TestContext.Current.CancellationToken);
        }
    }

    private static async Task<EmailOutboxMessage> ReadRowAsync(IHost host, string to)
    {
        var rows = await FindRowsAsync(host, to);
        return rows.ShouldHaveSingleItem();
    }

    // The dispatcher marks the row sent just after the transport returns, so wait for that save.
    private static async Task<EmailOutboxMessage> ReadSentRowAsync(IHost host, string to)
    {
        using var limit = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        limit.CancelAfter(Patience);
        while (!limit.IsCancellationRequested)
        {
            var row = await ReadRowAsync(host, to);
            if (row.SentAt is not null)
            {
                return row;
            }

            await Task.Delay(TimeSpan.FromMilliseconds(50), CancellationToken.None);
        }

        throw new TimeoutException("The outbox row was not marked sent in time.");
    }

    private static async Task<List<EmailOutboxMessage>> FindRowsAsync(IHost host, string to)
    {
        var context = await host.Services.GetRequiredService<IDbContextFactory<CspsDbContext>>()
            .CreateDbContextAsync(TestContext.Current.CancellationToken);
        await using (context)
        {
            return await context.EmailOutbox.AsNoTracking().Where(message => message.ToAddress == to)
                .ToListAsync(TestContext.Current.CancellationToken);
        }
    }

    // Composed like the Server composes Infrastructure, in a real host so the dispatcher runs, with the transport replaced.
    private async Task<IHost> StartHostAsync(RecordingTransport transport, bool dispatcherEnabled, TimeSpan? sweepInterval = null)
    {
        var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
        {
            EnvironmentName = CspsApiFactory.EnvironmentName,
            DisableDefaults = true,
        });
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            [DependencyInjection.ConnectionStringKey] = database.ConnectionString,
            [TestCertificates.CertificateBase64Setting] = TestCertificates.Current.Base64,
            [TestSecrets.CodeMacKeySetting] = TestSecrets.CodeMacKeyBase64,
            [TestCertificates.CertificatePasswordSetting] = TestCertificates.Current.Password,
            ["App:PublicBaseUrl"] = "https://localhost",
            ["Email:Dispatcher:Enabled"] = dispatcherEnabled ? "true" : "false",
            ["Email:Dispatcher:SweepInterval"] = (sweepInterval ?? TimeSpan.FromSeconds(1)).ToString("c", System.Globalization.CultureInfo.InvariantCulture),
        });
        builder.Services.AddSingleton<IRequestContext>(new FixedRequestContext());
        builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);
        builder.Services.RemoveAll<IEmailTransport>();
        builder.Services.AddSingleton<IEmailTransport>(transport);

        var host = builder.Build();
        await host.StartAsync(TestContext.Current.CancellationToken);
        return host;
    }

    private sealed class RecordingTransport : IEmailTransport
    {
        private readonly ConcurrentQueue<OutgoingEmail> _sent = new();

        public Task SendAsync(OutgoingEmail email, CancellationToken cancellationToken)
        {
            _sent.Enqueue(email);
            return Task.CompletedTask;
        }

        public List<OutgoingEmail> Messages(string to) => [.. _sent.Where(email => email.To == to)];

        public async Task<OutgoingEmail> WaitForAsync(string to, TimeSpan timeout)
        {
            using var limit = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
            limit.CancelAfter(timeout);
            while (!limit.IsCancellationRequested)
            {
                var found = Messages(to);
                if (found.Count > 0)
                {
                    return found.ShouldHaveSingleItem();
                }

                await Task.Delay(TimeSpan.FromMilliseconds(50), CancellationToken.None);
            }

            throw new TimeoutException($"No mail reached the transport for {to} within {timeout}.");
        }
    }
}
