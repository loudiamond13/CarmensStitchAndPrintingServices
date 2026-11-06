using Csps.Application.Maintenance;
using Csps.Domain.Identity;
using Csps.Infrastructure.Email;
using Csps.Infrastructure.Idempotency;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.Maintenance;

/// <summary>
/// Removes rows whose time has passed: request keys and idempotency claims (SEC-06), ended sessions, 2FA challenges, account links and
/// closed outbox emails (JOB-01, D-35). Each rule has its own
/// safety margin so no row a live rule still reads is removed. A database failure in one rule is logged and reported as a failed line for
/// that rule only; the other rules still run and the run never throws for it.
/// </summary>
/// <param name="context">The database context.</param>
/// <param name="time">The clock.</param>
/// <param name="logger">The logger.</param>
internal sealed partial class PurgeExpiredRecordsJob(CspsDbContext context, TimeProvider time, ILogger<PurgeExpiredRecordsJob> logger) : IMaintenanceJob
{
    internal const string RequestKeysLabel = "Expired request keys removed";

    internal const string SessionsLabel = "Expired sign-in tokens removed";

    internal const string ChallengesLabel = "Expired 2FA codes removed";

    internal const string AccountLinksLabel = "Expired account links removed";

    internal const string OutboxLabel = "Old sent emails removed";

    internal const int BatchSize = 500;

    /// <summary>A session is removed this long after its fixed end; it can never be used again before then.</summary>
    internal static readonly TimeSpan SessionMargin = TimeSpan.FromDays(1);

    /// <summary>A 2FA challenge is removed this long after it expires; the send and failure windows are 1 hour.</summary>
    internal static readonly TimeSpan ChallengeMargin = TimeSpan.FromDays(1);

    /// <summary>A reset or invite link is removed this long after it expires, so "already used" and "expired" messages stay accurate.</summary>
    internal static readonly TimeSpan AccountLinkMargin = TimeSpan.FromDays(7);

    /// <summary>A sent, failed or expired email row is removed this long after it closed (D-35).</summary>
    internal static readonly TimeSpan OutboxRetention = TimeSpan.FromDays(30);

    /// <inheritdoc />
    public int Order => 10;

    /// <inheritdoc />
    public string Name => "purge-expired-records";

    /// <inheritdoc />
    public async Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(budget);

        var lines = new List<MaintenanceLine>();
        foreach (var rule in Rules(time.GetUtcNow()))
        {
            var (line, more) = await PurgeAsync(rule, budget, cancellationToken).ConfigureAwait(false);
            lines.Add(line);
            if (more)
            {
                return new MaintenanceJobReport(lines, true);
            }
        }

        return new MaintenanceJobReport(lines, false);
    }

    // The rules in run order. A rule with two steps (request keys, then claims) reports one line.
    private List<PurgeRule> Rules(DateTimeOffset now)
    {
        var sessionCutOff = now - SessionMargin;
        var challengeCutOff = now - ChallengeMargin;
        var linkCutOff = now - AccountLinkMargin;
        var outboxCutOff = now - OutboxRetention;
        return
        [
            new PurgeRule(
                RequestKeysLabel,
                "The expired request keys could not be removed.",
                [
                    token => context.Set<IdempotencyRecord>()
                        .Where(record => record.ExpiresAt <= now)
                        .OrderBy(record => record.ExpiresAt)
                        .Take(BatchSize)
                        .ExecuteDeleteAsync(token),
                    token => context.Set<DatabaseLock>()
                        .Where(claim => claim.ExpiresAtUtc != null && claim.ExpiresAtUtc <= now)
                        .OrderBy(claim => claim.ExpiresAtUtc)
                        .Take(BatchSize)
                        .ExecuteDeleteAsync(token),
                ]),
            new PurgeRule(
                SessionsLabel,
                "The expired sign-in tokens could not be removed.",
                [
                    // Refresh tokens go with their session through the database cascade.
                    token => context.Set<UserSession>()
                        .Where(session => session.AbsoluteExpiresAt < sessionCutOff)
                        .OrderBy(session => session.AbsoluteExpiresAt)
                        .Take(BatchSize)
                        .ExecuteDeleteAsync(token),
                ]),
            new PurgeRule(
                ChallengesLabel,
                "The expired 2FA codes could not be removed.",
                [
                    // The codes of a challenge go with it through the database cascade.
                    token => context.Set<TwoFactorChallenge>()
                        .Where(challenge => challenge.ExpiresAt < challengeCutOff)
                        .OrderBy(challenge => challenge.ExpiresAt)
                        .Take(BatchSize)
                        .ExecuteDeleteAsync(token),
                ]),
            new PurgeRule(
                AccountLinksLabel,
                "The expired account links could not be removed.",
                [
                    token => context.Set<AccountToken>()
                        .Where(link => link.ExpiresAt < linkCutOff)
                        .OrderBy(link => link.ExpiresAt)
                        .Take(BatchSize)
                        .ExecuteDeleteAsync(token),
                ]),
            new PurgeRule(
                OutboxLabel,
                "The old sent emails could not be removed.",
                [
                    // Closed means sent, failed or expired; every close time that is set must be past the cut-off, and open rows never match.
                    token => context.Set<EmailOutboxMessage>()
                        .Where(message => (message.SentAt != null || message.FailedAt != null || message.ExpiredAt != null)
                            && (message.SentAt == null || message.SentAt < outboxCutOff)
                            && (message.FailedAt == null || message.FailedAt < outboxCutOff)
                            && (message.ExpiredAt == null || message.ExpiredAt < outboxCutOff))
                        .OrderBy(message => message.CreatedAt)
                        .Take(BatchSize)
                        .ExecuteDeleteAsync(token),
                ]),
        ];
    }

    private async Task<(MaintenanceLine Line, bool More)> PurgeAsync(PurgeRule rule, MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        try
        {
            long removed = 0;
            foreach (var step in rule.Steps)
            {
                var (count, more) = await DrainAsync(step, budget, cancellationToken).ConfigureAwait(false);
                removed += count;
                if (more)
                {
                    return (new MaintenanceLine(rule.Label, removed, false, null), true);
                }
            }

            return (new MaintenanceLine(rule.Label, removed, false, null), false);
        }
        catch (Exception exception) when (SqlErrors.IsDatabaseFailure(exception))
        {
            LogPurgeFailed(logger, rule.Label, exception);
            return (new MaintenanceLine(rule.Label, null, true, rule.FailedText), false);
        }
    }

    // Deletes one batch at a time. A full batch may mean more rows are left: the budget is checked then, and a spent budget ends the pass with More.
    private static async Task<(long Removed, bool More)> DrainAsync(
        Func<CancellationToken, Task<int>> deleteBatch, MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        long removed = 0;
        while (true)
        {
            var batch = await deleteBatch(cancellationToken).ConfigureAwait(false);
            removed += batch;
            if (batch < BatchSize)
            {
                return (removed, false);
            }

            if (budget.IsSpent)
            {
                return (removed, true);
            }
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "The maintenance purge '{Label}' could not remove its rows.")]
    private static partial void LogPurgeFailed(ILogger logger, string label, Exception exception);

    private sealed record PurgeRule(string Label, string FailedText, IReadOnlyList<Func<CancellationToken, Task<int>>> Steps);
}
