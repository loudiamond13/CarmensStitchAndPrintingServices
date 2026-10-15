using System.Security.Cryptography;
using Csps.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.Email;

/// <summary>
/// Sends due outbox mail in the background (AUTH-13): right after a commit signals it, and on a periodic sweep so a
/// restart drains what was left. A sent row is wiped. Retry backoff, expiry and the single-send claim are plan 04-33.
/// Logs carry the row id and an error code only, never an address, subject or body (CWE-532).
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
                await SendAsync(context, protector, message, cancellationToken).ConfigureAwait(false);
            }
        }
    }

    private async Task SendAsync(CspsDbContext context, IDataProtector protector, EmailOutboxMessage message, CancellationToken cancellationToken)
    {
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
            LogUnreadable(logger, message.Id);
            await SaveAsync(context, message, cancellationToken).ConfigureAwait(false);
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
#pragma warning disable CA1031 // Any transport failure leaves the row due; only its type is kept.
        catch (Exception exception)
#pragma warning restore CA1031
        {
            message.MarkAttemptFailed(exception.GetType().Name);
            LogSendFailed(logger, message.Id, message.LastErrorCode ?? string.Empty);
            await SaveAsync(context, message, cancellationToken).ConfigureAwait(false);
            return;
        }

        message.MarkSent(time.GetUtcNow());
        await SaveAsync(context, message, cancellationToken).ConfigureAwait(false);
    }

    private async Task SaveAsync(CspsDbContext context, EmailOutboxMessage message, CancellationToken cancellationToken)
    {
        try
        {
            await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (DbUpdateConcurrencyException)
        {
            LogConcurrentUpdate(logger, message.Id);
            context.ChangeTracker.Clear();
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Email {MessageId} was not sent: {ErrorCode}")]
    private static partial void LogSendFailed(ILogger logger, Guid messageId, string errorCode);

    [LoggerMessage(Level = LogLevel.Error, Message = "Email {MessageId} cannot be decrypted and was closed")]
    private static partial void LogUnreadable(ILogger logger, Guid messageId);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Email {MessageId} was changed by another process and was skipped")]
    private static partial void LogConcurrentUpdate(ILogger logger, Guid messageId);

    [LoggerMessage(Level = LogLevel.Error, Message = "The email sweep failed: {ErrorType}")]
    private static partial void LogSweepFailed(ILogger logger, string errorType);
}
