using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Analytics;

/// <summary>
/// <see cref="IVisitorStatsReader"/> over EF: untracked LINQ aggregates (ANL-08). Page views are summed from the daily counts, which a day
/// with no visits does not write, so a missing day adds nothing. Visits and unique visitors come from the raw visits on the days the cut keeps.
/// </summary>
/// <param name="context">The scoped database context.</param>
internal sealed class VisitorStatsReader(CspsDbContext context) : IVisitorStatsReader
{
    public async Task<VisitorTotals> ReadTotalsAsync(DateOnly first, DateOnly last, DateOnly cut, CancellationToken cancellationToken)
    {
        var views = await context.DailyPageCounts
            .AsNoTracking()
            .Where(row => row.BusinessDay >= first && row.BusinessDay <= last)
            .SumAsync(row => (long?)row.Views, cancellationToken)
            .ConfigureAwait(false) ?? 0;
        var pageViews = (int)Math.Min(views, int.MaxValue);

        var start = first > cut ? first : cut;
        if (start > last)
        {
            return new VisitorTotals(0, 0, pageViews);
        }

        var visits = context.AnalyticsVisits.AsNoTracking().Where(row => row.BusinessDay >= start && row.BusinessDay <= last);
        var visitCount = await visits.CountAsync(cancellationToken).ConfigureAwait(false);
        var uniqueCount = await visits.Select(row => row.VisitorHash).Distinct().CountAsync(cancellationToken).ConfigureAwait(false);
        return new VisitorTotals(uniqueCount, visitCount, pageViews);
    }

    public async Task<IReadOnlyList<TrendCount>> ReadTrendAsync(DateOnly first, DateOnly last, DateOnly cut, StatsBucketKind bucket, CancellationToken cancellationToken)
    {
        var days = context.DailyPageCounts.AsNoTracking().Where(row => row.BusinessDay >= first && row.BusinessDay <= last);
        var views = bucket == StatsBucketKind.Day
            ? await days
                .GroupBy(row => row.BusinessDay)
                .Select(group => new BucketFigure(group.Key.Year, group.Key.Month, group.Key.Day, group.Sum(row => (long)row.Views)))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false)
            : await days
                .GroupBy(row => new { row.BusinessDay.Year, row.BusinessDay.Month })
                .Select(group => new BucketFigure(group.Key.Year, group.Key.Month, 1, group.Sum(row => (long)row.Views)))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

        // Unique visitors are a distinct count over each bucket's raw visits from the cut on, never a sum of days.
        var start = first > cut ? first : cut;
        var visits = context.AnalyticsVisits.AsNoTracking().Where(row => row.BusinessDay >= start && row.BusinessDay <= last);
        List<BucketFigure> visitors = start > last
            ? []
            : bucket == StatsBucketKind.Day
                ? await visits
                    .GroupBy(row => row.BusinessDay)
                    .Select(group => new BucketFigure(group.Key.Year, group.Key.Month, group.Key.Day, group.Select(row => row.VisitorHash).Distinct().Count()))
                    .ToListAsync(cancellationToken)
                    .ConfigureAwait(false)
                : await visits
                    .GroupBy(row => new { row.BusinessDay.Year, row.BusinessDay.Month })
                    .Select(group => new BucketFigure(group.Key.Year, group.Key.Month, 1, group.Select(row => row.VisitorHash).Distinct().Count()))
                    .ToListAsync(cancellationToken)
                    .ConfigureAwait(false);

        var viewsByStart = views.ToDictionary(row => row.Start, row => (int)Math.Min(row.Value, int.MaxValue));
        var visitorsByStart = visitors.ToDictionary(row => row.Start, row => (int)row.Value);
        return [.. viewsByStart.Keys.Union(visitorsByStart.Keys)
            .Order()
            .Select(day => new TrendCount(day, viewsByStart.GetValueOrDefault(day), visitorsByStart.GetValueOrDefault(day)))];
    }

    public async Task<VisitorLists> ReadListsAsync(DateOnly first, DateOnly last, DateOnly cut, CancellationToken cancellationToken)
    {
        var pages = await context.DailyPageCounts
            .AsNoTracking()
            .Where(row => row.BusinessDay >= first && row.BusinessDay <= last)
            .GroupBy(row => row.PageKey)
            .Select(group => new NamedCount(group.Key, group.Sum(row => (long)row.Views)))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        // D-27: raw visits on the days from the cut on, the rolled-up daily rows on the days before it.
        var rawFirst = first > cut ? first : cut;
        var rolledLast = last < cut ? last : cut.AddDays(-1);
        List<NamedCount> rawReferrers = [], rawDevices = [], rawBrowsers = [], rolledReferrers = [], rolledDevices = [], rolledBrowsers = [];
        if (rawFirst <= last)
        {
            var visits = context.AnalyticsVisits.AsNoTracking().Where(row => row.BusinessDay >= rawFirst && row.BusinessDay <= last);
            rawReferrers = await visits
                .GroupBy(row => row.Referrer)
                .Select(group => new NamedCount(group.Key, group.LongCount()))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
            var devices = await visits
                .GroupBy(row => row.Device)
                .Select(group => new { Device = group.Key, Count = group.LongCount() })
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
            rawDevices = [.. devices.Select(static row => new NamedCount(row.Device.ToString(), row.Count))];
            rawBrowsers = await visits
                .GroupBy(row => row.Browser)
                .Select(group => new NamedCount(group.Key, group.LongCount()))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
        }

        if (first <= rolledLast)
        {
            rolledReferrers = await context.DailyReferrerCounts
                .AsNoTracking()
                .Where(row => row.BusinessDay >= first && row.BusinessDay <= rolledLast)
                .GroupBy(row => row.Referrer)
                .Select(group => new NamedCount(group.Key, group.Sum(row => (long)row.Visits)))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
            var labels = context.DailyDeviceCounts.AsNoTracking().Where(row => row.BusinessDay >= first && row.BusinessDay <= rolledLast);
            rolledDevices = await RolledLabelsAsync(labels, DeviceDimension.Device, cancellationToken).ConfigureAwait(false);
            rolledBrowsers = await RolledLabelsAsync(labels, DeviceDimension.Browser, cancellationToken).ConfigureAwait(false);
        }

        return new VisitorLists(pages, Merge(rawReferrers, rolledReferrers), Merge(rawDevices, rolledDevices), Merge(rawBrowsers, rolledBrowsers));
    }

    private static Task<List<NamedCount>> RolledLabelsAsync(IQueryable<DailyDeviceCount> rows, DeviceDimension dimension, CancellationToken cancellationToken) =>
        rows.Where(row => row.Dimension == dimension)
            .GroupBy(row => row.Name)
            .Select(group => new NamedCount(group.Key, group.Sum(row => (long)row.Visits)))
            .ToListAsync(cancellationToken);

    /// <summary>One count per name: the raw and the rolled-up counts of the same name are added.</summary>
    private static List<NamedCount> Merge(List<NamedCount> raw, List<NamedCount> rolled) =>
        [.. raw.Concat(rolled)
            .GroupBy(static row => row.Name, StringComparer.Ordinal)
            .Select(static group => new NamedCount(group.Key, group.Sum(static row => row.Count)))];

    /// <summary>One aggregate of a bucket: the day, or the month on its first day.</summary>
    private sealed record BucketFigure(int Year, int Month, int Day, long Value)
    {
        public DateOnly Start => new(Year, Month, Day);
    }
}
