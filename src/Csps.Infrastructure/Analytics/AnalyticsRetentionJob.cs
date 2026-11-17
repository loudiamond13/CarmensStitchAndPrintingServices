using System.Globalization;
using Csps.Application.Maintenance;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.Analytics;

/// <summary>
/// Keeps visitor analytics for the published time and no longer (ANL-09, D-03 to D-05, D-07). Each closed business day is first rolled up
/// into anonymous daily referrer and device totals, oldest first, one day per transaction; the day the work reached is saved in the
/// maintenance cursor. A database failure in one rule is logged and reported as that rule's failed line; the other rules still run.
/// </summary>
/// <param name="context">The database context.</param>
/// <param name="calendar">The business calendar (Asia/Manila by default).</param>
/// <param name="cursors">Keeps the last rolled-up day.</param>
/// <param name="logger">The logger.</param>
internal sealed partial class AnalyticsRetentionJob(
    CspsDbContext context,
    IBusinessCalendar calendar,
    IMaintenanceCursors cursors,
    ILogger<AnalyticsRetentionJob> logger) : IMaintenanceJob
{
    internal const string RolledUpLabel = "Visitor days rolled up";

    internal const string RawLabel = "Old visit records removed";

    internal const string ConsentLabel = "Old cookie choices removed";

    internal const string JobName = "analytics-retention";

    internal const int BatchSize = 500;

    private const string CursorFormat = "yyyy-MM-dd";

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

        // The rules in run order: the rollup first, so a raw day is only ever removed after its totals are kept. A rule that stops for the
        // budget ends the pass with More; the next pass carries on from there.
        var rules = new List<(string Label, string FailedText, Func<Task<(long Count, bool More)>> Work)>
        {
            (RolledUpLabel, "The visitor days could not be rolled up.", () => RollUpAsync(today, budget, cancellationToken)),
            (RawLabel, "The old visit records could not be removed.", () => PurgeRawVisitsAsync(today, budget, cancellationToken)),
            (ConsentLabel, "The old cookie choices could not be removed.", () => PurgeConsentAsync(now, budget, cancellationToken)),
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

    // Rolls every closed day after the cursor, oldest first. Each day is one transaction that replaces the day's rows and moves the cursor,
    // so a crash and a retry never count a day twice. At least one day is rolled per pass; a spent budget then stops the pass with More.
    private async Task<(long Count, bool More)> RollUpAsync(DateOnly today, MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        var yesterday = today.AddDays(-1);
        var rolledThrough = await ReadCursorAsync(cancellationToken).ConfigureAwait(false);

        var days = await context.AnalyticsVisits
            .AsNoTracking()
            .Where(visit => visit.BusinessDay <= yesterday && (rolledThrough == null || visit.BusinessDay > rolledThrough))
            .Select(visit => visit.BusinessDay)
            .Distinct()
            .OrderBy(day => day)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        long rolled = 0;
        for (var index = 0; index < days.Count; index++)
        {
            await RollDayAsync(days[index], cancellationToken).ConfigureAwait(false);
            rolled++;
            if (index < days.Count - 1 && budget.IsSpent)
            {
                return (rolled, true);
            }
        }

        if (rolledThrough != yesterday)
        {
            await cursors.SaveAsync(JobName, yesterday.ToString(CursorFormat, CultureInfo.InvariantCulture), cancellationToken).ConfigureAwait(false);
        }

        return (rolled, false);
    }

    private async Task RollDayAsync(DateOnly day, CancellationToken cancellationToken)
    {
        var transaction = await context.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            await context.DailyReferrerCounts.Where(row => row.BusinessDay == day).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
            await context.DailyDeviceCounts.Where(row => row.BusinessDay == day).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);

            var visits = context.AnalyticsVisits.AsNoTracking().Where(visit => visit.BusinessDay == day);
            var referrers = await visits
                .GroupBy(visit => visit.Referrer)
                .Select(group => new { Name = group.Key, Visits = group.Count() })
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
            var devices = await visits
                .GroupBy(visit => visit.Device)
                .Select(group => new { Device = group.Key, Visits = group.Count() })
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
            var browsers = await visits
                .GroupBy(visit => visit.Browser)
                .Select(group => new { Name = group.Key, Visits = group.Count() })
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            context.DailyReferrerCounts.AddRange(referrers.Select(row => DailyReferrerCount.Of(day, row.Name, row.Visits)));
            context.DailyDeviceCounts.AddRange(devices.Select(row => DailyDeviceCount.Of(day, DeviceDimension.Device, row.Device.ToString(), row.Visits)));
            context.DailyDeviceCounts.AddRange(browsers.Select(row => DailyDeviceCount.Of(day, DeviceDimension.Browser, row.Name, row.Visits)));
            await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            context.ChangeTracker.Clear();

            await cursors.SaveAsync(JobName, day.ToString(CursorFormat, CultureInfo.InvariantCulture), cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    // Removes visits, page views and speed samples older than the raw cut (D-03), children first, and only for days the cursor shows rolled up.
    private async Task<(long Count, bool More)> PurgeRawVisitsAsync(DateOnly today, MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        var rolledThrough = await ReadCursorAsync(cancellationToken).ConfigureAwait(false);
        if (rolledThrough is not { } last)
        {
            return (0, false);
        }

        var rawCut = AnalyticsRetention.RawCut(today);
        var before = rawCut <= last ? rawCut : last.AddDays(1);
        return await DrainAsync(
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
            cancellationToken).ConfigureAwait(false);
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

    // The last rolled day, or null when none is saved or the saved text is not a date.
    private async Task<DateOnly?> ReadCursorAsync(CancellationToken cancellationToken)
    {
        var text = await cursors.GetAsync(JobName, cancellationToken).ConfigureAwait(false);
        return DateOnly.TryParseExact(text, CursorFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var day) ? day : null;
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "The analytics retention rule '{Label}' failed.")]
    private static partial void LogRuleFailed(ILogger logger, string label, Exception exception);
}
