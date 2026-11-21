using Csps.Application.Maintenance;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.Analytics;

/// <summary>
/// Keeps visitor analytics for the published time and no longer (ANL-09, D-03 to D-05, D-07, D-61, D-64). Each rule only removes rows past
/// its cut date. A database failure in one rule is logged and reported as that rule's failed line, and the other rules still run.
/// </summary>
/// <param name="context">The database context.</param>
/// <param name="calendar">The business calendar (Asia/Manila by default).</param>
/// <param name="logger">The logger.</param>
internal sealed partial class AnalyticsRetentionJob(
    CspsDbContext context,
    IBusinessCalendar calendar,
    ILogger<AnalyticsRetentionJob> logger) : IMaintenanceJob
{
    internal const string RawLabel = "Old visit records removed";

    internal const string ConsentLabel = "Old cookie choices removed";

    internal const string DailyLabel = "Old daily page counts removed";

    internal const string SaltLabel = "Old address salts removed";

    internal const string JobName = "analytics-retention";

    internal const int BatchSize = 500;

    /// <inheritdoc />
    public int Order => 15;

    /// <inheritdoc />
    public string Name => JobName;

    /// <inheritdoc />
    public async Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(budget);

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var today = clock.Today;
        var now = clock.UtcNow;
        var lines = new List<MaintenanceLine>();

        // The rules in run order. A rule that stops for the budget ends the pass with More; the next pass carries on from there.
        var rules = new List<(string Label, string FailedText, Func<Task<(long Count, bool More)>> Work)>
        {
            (RawLabel, "The old visit records could not be removed.", () => PurgeRawVisitsAsync(today, budget, cancellationToken)),
            (ConsentLabel, "The old cookie choices could not be removed.", () => PurgeConsentAsync(now, budget, cancellationToken)),
            (DailyLabel, "The old daily page counts could not be removed.", () => PurgeDailyTotalsAsync(today, budget, cancellationToken)),
            (SaltLabel, "The old address salts could not be removed.", () => PurgeSaltsAsync(today, budget, cancellationToken)),
        };
        foreach (var (label, failedText, work) in rules)
        {
            var (line, more) = await RunRuleAsync(label, failedText, work).ConfigureAwait(false);
            lines.Add(line);
            if (more)
            {
                return new MaintenanceJobReport(lines, true);
            }
        }

        return new MaintenanceJobReport(lines, false);
    }

    // Runs one rule. A database failure is logged and becomes the rule's failed line, so the run never throws for it.
    private async Task<(MaintenanceLine Line, bool More)> RunRuleAsync(string label, string failedText, Func<Task<(long Count, bool More)>> work)
    {
        try
        {
            var (count, more) = await work().ConfigureAwait(false);
            return (new MaintenanceLine(label, count, false, null), more);
        }
        catch (Exception exception) when (SqlErrors.IsDatabaseFailure(exception))
        {
            context.ChangeTracker.Clear();
            LogRuleFailed(logger, label, exception);
            return (new MaintenanceLine(label, null, true, failedText), false);
        }
    }

    // Removes visits, page views and speed samples older than the raw cut, by date alone, children first.
    private Task<(long Count, bool More)> PurgeRawVisitsAsync(DateOnly today, MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        var before = AnalyticsRetention.RawCut(today);
        return DrainAsync(
            [
                token => context.AnalyticsVitalSamples
                    .Where(sample => sample.BusinessDay < before)
                    .OrderBy(sample => sample.Id)
                    .Take(BatchSize)
                    .ExecuteDeleteAsync(token),
                token => context.AnalyticsPageViews
                    .Where(view => view.BusinessDay < before)
                    .OrderBy(view => view.Id)
                    .Take(BatchSize)
                    .ExecuteDeleteAsync(token),
                token => context.AnalyticsVisits
                    .Where(visit => visit.BusinessDay < before)
                    .OrderBy(visit => visit.BusinessDay)
                    .Take(BatchSize)
                    .ExecuteDeleteAsync(token),
            ],
            budget,
            cancellationToken);
    }

    // Removes cookie choices decided before the consent cut (D-05).
    private Task<(long Count, bool More)> PurgeConsentAsync(DateTimeOffset now, MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        var cut = AnalyticsRetention.ConsentPurgeBefore(now);
        return DrainAsync(
            [
                token => context.ConsentRecords
                    .Where(record => record.DecidedAtUtc < cut)
                    .OrderBy(record => record.DecidedAtUtc)
                    .Take(BatchSize)
                    .ExecuteDeleteAsync(token),
            ],
            budget,
            cancellationToken);
    }

    // Removes the daily page, referrer and device totals older than the daily floor (D-04).
    private Task<(long Count, bool More)> PurgeDailyTotalsAsync(DateOnly today, MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        var floor = AnalyticsRetention.DailyFloor(today);
        return DrainAsync(
            [
                token => context.DailyPageCounts
                    .Where(row => row.BusinessDay < floor)
                    .OrderBy(row => row.BusinessDay)
                    .Take(BatchSize)
                    .ExecuteDeleteAsync(token),
                token => context.DailyReferrerCounts
                    .Where(row => row.BusinessDay < floor)
                    .OrderBy(row => row.BusinessDay)
                    .Take(BatchSize)
                    .ExecuteDeleteAsync(token),
                token => context.DailyDeviceCounts
                    .Where(row => row.BusinessDay < floor)
                    .OrderBy(row => row.BusinessDay)
                    .Take(BatchSize)
                    .ExecuteDeleteAsync(token),
            ],
            budget,
            cancellationToken);
    }

    // Removes salts older than the salt life, so an old address hash can never be recomputed (D-07).
    private Task<(long Count, bool More)> PurgeSaltsAsync(DateOnly today, MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        var before = AnalyticsRetention.SaltCut(today);
        return DrainAsync(
            [
                token => context.AnalyticsSalts
                    .Where(salt => salt.BusinessDay < before)
                    .OrderBy(salt => salt.BusinessDay)
                    .Take(BatchSize)
                    .ExecuteDeleteAsync(token),
            ],
            budget,
            cancellationToken);
    }

    // Runs each step in batches until it removes less than a full batch. A full batch may mean more rows are left: the budget is checked
    // then, and a spent budget ends the pass with More.
    private static async Task<(long Count, bool More)> DrainAsync(
        IReadOnlyList<Func<CancellationToken, Task<int>>> steps, MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        long removed = 0;
        foreach (var step in steps)
        {
            while (true)
            {
                var batch = await step(cancellationToken).ConfigureAwait(false);
                removed += batch;
                if (batch < BatchSize)
                {
                    break;
                }

                if (budget.IsSpent)
                {
                    return (removed, true);
                }
            }
        }

        return (removed, false);
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "The analytics retention rule '{Label}' failed.")]
    private static partial void LogRuleFailed(ILogger logger, string label, Exception exception);
}
