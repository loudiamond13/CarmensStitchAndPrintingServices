using System.Net.Sockets;
using System.Security.Cryptography;
using Csps.Application.Email;
using Csps.Infrastructure.Persistence;
using MailKit;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.Email;

/// <summary>
/// Sends due outbox mail in the background (AUTH-13): right after a commit signals it, and on a periodic sweep so a
/// restart drains what was left. A failed send is retried quietly on a fixed schedule for about 10 minutes, then the
/// row is closed (D-33); a row past its NotAfter is closed unsent. A row is leased with a rowversion check before it is
/// sent, so two dispatchers never send it twice. Closed rows are wiped. Logs carry the row id, the kind and a short
/// error code only, never an address, subject, body or exception text (CWE-532).
/// </summary>
internal sealed partial class EmailDispatcher(
    IDbContextFactory<CspsDbContext> contexts,
    IDataProtectionProvider protection,
    IEmailTransport transport,
    OutboxSignal signal,
    TimeProvider time,
    IOptions<EmailDispatcherOptions> options,
    ILogger<EmailDispatcher> logger) : BackgroundService
{
    private const int BatchSize = 50;

    private static readonly TimeSpan ClaimLease = TimeSpan.FromMinutes(2);

    /// <summary>Waits after the first five failed sends (30 s, 1 min, 2 min, 4 min, 2.5 min); a sixth failure closes the row (D-33).</summary>
    internal static IReadOnlyList<TimeSpan> RetryDelays { get; } =
        [TimeSpan.FromSeconds(30), TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(2), TimeSpan.FromMinutes(4), TimeSpan.FromSeconds(150)];

    /// <summary>Maps a transport failure to a short code. The exception message is never kept (CWE-532).</summary>
    /// <param name="exception">The failure.</param>
    /// <returns>One of <c>smtp-connect</c>, <c>smtp-auth</c>, <c>smtp-send</c> or <c>unknown</c>.</returns>
    internal static string ErrorCodeFor(Exception exception) => exception switch
    {
        MailKit.Security.AuthenticationException or ServiceNotAuthenticatedException or SaslException => "smtp-auth",
        SmtpCommandException or ProtocolException => "smtp-send",
        SocketException or IOException or TimeoutException or System.Security.Authentication.AuthenticationException or ServiceNotConnectedException => "smtp-connect",
        _ => "unknown",
    };

    /// <inheritdoc />
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SweepAsync(stoppingToken).ConfigureAwait(false);
                await signal.WaitAsync(options.Value.SweepInterval, stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
#pragma warning disable CA1031 // The loop must outlive any one failure; the error is logged by type only.
            catch (Exception exception)
#pragma warning restore CA1031
            {
                LogSweepFailed(logger, exception.GetType().Name);
                await Task.Delay(options.Value.SweepInterval, time, stoppingToken).ConfigureAwait(false);
            }
        }
    }

    /// <summary>Processes the rows that are due now, oldest first.</summary>
    /// <param name="cancellationToken">Stops the sweep.</param>
    /// <returns>A task that completes when the batch is handled.</returns>
    internal async Task SweepAsync(CancellationToken cancellationToken)
    {
        var context = await contexts.CreateDbContextAsync(cancellationToken).ConfigureAwait(false);
        await using (context.ConfigureAwait(false))
        {
            var now = time.GetUtcNow();
            var due = await context.EmailOutbox
                .Where(message => message.SentAt == null && message.FailedAt == null && message.ExpiredAt == null && message.NextAttemptAt <= now)
                .OrderBy(message => message.NextAttemptAt)
                .Take(BatchSize)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            var protector = protection.CreateProtector(OutboxEmailSender.ProtectionPurpose);
            foreach (var message in due)
            {
                await ProcessAsync(context, protector, message, cancellationToken).ConfigureAwait(false);
            }
        }
    }

    private async Task ProcessAsync(CspsDbContext context, IDataProtector protector, EmailOutboxMessage message, CancellationToken cancellationToken)
    {
        var now = time.GetUtcNow();
        if (now >= message.NotAfter)
        {
            message.MarkExpired(now);
            if (await TrySaveAsync(context, message, cancellationToken).ConfigureAwait(false))
            {
                LogExpired(logger, message.Id, message.Kind);
            }

            return;
        }

        // The lease is saved with the row version: a conflict means another dispatcher owns the row.
        message.Claim(now + ClaimLease);
        if (!await TrySaveAsync(context, message, cancellationToken).ConfigureAwait(false))
        {
            return;
        }

        OutgoingEmail email;
        try
        {
            email = new OutgoingEmail(
                message.ToAddress,
                protector.Unprotect(message.ProtectedSubject ?? string.Empty),
                protector.Unprotect(message.ProtectedText ?? string.Empty),
                protector.Unprotect(message.ProtectedHtml ?? string.Empty));
        }
        catch (CryptographicException)
        {
            // The content can never be read again (for example a lost key), so retrying is pointless.
            message.MarkFailed(time.GetUtcNow(), "unreadable");
            LogUnreadable(logger, message.Id, message.Kind);
            await TrySaveAsync(context, message, cancellationToken).ConfigureAwait(false);
            return;
        }

        try
        {
            await transport.SendAsync(email, cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
#pragma warning disable CA1031 // Any transport failure goes to the retry schedule; only a short code is kept.
        catch (Exception exception)
#pragma warning restore CA1031
        {
            await RecordFailureAsync(context, message, ErrorCodeFor(exception), cancellationToken).ConfigureAwait(false);
            return;
        }

        message.MarkSent(time.GetUtcNow());
        await TrySaveAsync(context, message, cancellationToken).ConfigureAwait(false);
    }

    private async Task RecordFailureAsync(CspsDbContext context, EmailOutboxMessage message, string errorCode, CancellationToken cancellationToken)
    {
        var now = time.GetUtcNow();
        message.MarkAttemptFailed(errorCode);
        if (message.Attempts <= RetryDelays.Count)
        {
            message.RetryAt(now + RetryDelays[message.Attempts - 1]);
            if (await TrySaveAsync(context, message, cancellationToken).ConfigureAwait(false))
            {
                LogRetryScheduled(logger, message.Id, message.Kind, errorCode);
            }

            return;
        }

        message.MarkFailed(now, errorCode);
        if (await TrySaveAsync(context, message, cancellationToken).ConfigureAwait(false))
        {
            LogGivenUp(logger, message.Id, message.Kind, errorCode);
        }
    }

    // False when another dispatcher changed the row first; the row is dropped from this context so later saves are unaffected.
    private async Task<bool> TrySaveAsync(CspsDbContext context, EmailOutboxMessage message, CancellationToken cancellationToken)
    {
        try
        {
            await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            LogClaimedElsewhere(logger, message.Id);
            context.Entry(message).State = EntityState.Detached;
            return false;
        }
    }

    [LoggerMessage(Level = LogLevel.Debug, Message = "Email {MessageId} ({Kind}) failed with {ErrorCode} and will be retried")]
    private static partial void LogRetryScheduled(ILogger logger, Guid messageId, AuthEmailKind kind, string errorCode);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Email {MessageId} ({Kind}) was not sent and was closed: {ErrorCode}")]
    private static partial void LogGivenUp(ILogger logger, Guid messageId, AuthEmailKind kind, string errorCode);

    [LoggerMessage(Level = LogLevel.Information, Message = "Email {MessageId} ({Kind}) expired before it was sent")]
    private static partial void LogExpired(ILogger logger, Guid messageId, AuthEmailKind kind);

    [LoggerMessage(Level = LogLevel.Error, Message = "Email {MessageId} ({Kind}) cannot be decrypted and was closed")]
    private static partial void LogUnreadable(ILogger logger, Guid messageId, AuthEmailKind kind);

    [LoggerMessage(Level = LogLevel.Debug, Message = "Email {MessageId} was claimed by another dispatcher and was skipped")]
    private static partial void LogClaimedElsewhere(ILogger logger, Guid messageId);

    [LoggerMessage(Level = LogLevel.Error, Message = "The email sweep failed: {ErrorType}")]
    private static partial void LogSweepFailed(ILogger logger, string errorType);
}
