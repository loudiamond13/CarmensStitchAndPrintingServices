using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Analytics;

/// <summary>
/// <see cref="IVisitorStatsReader"/> over EF: untracked LINQ aggregates (ANL-08). Every figure, the CSV export included, comes from the daily page
/// counts, which a day with no views does not write, so a missing day adds nothing.
/// </summary>
/// <param name="context">The scoped database context.</param>
internal sealed class VisitorStatsReader(CspsDbContext context) : IVisitorStatsReader
{
    public async Task<int> ReadPageViewsAsync(DateOnly first, DateOnly last, CancellationToken cancellationToken)
    {
        var views = await InRange(first, last)
            .SumAsync(row => (long?)row.Views, cancellationToken)
            .ConfigureAwait(false) ?? 0;
        return (int)Math.Min(views, int.MaxValue);
    }

    public async Task<IReadOnlyList<TrendCount>> ReadTrendAsync(DateOnly first, DateOnly last, StatsBucketKind bucket, CancellationToken cancellationToken)
    {
        var days = InRange(first, last);
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

        return [.. views
            .OrderBy(row => row.Start)
            .Select(row => new TrendCount(row.Start, (int)Math.Min(row.Value, int.MaxValue)))];
    }

    public async Task<IReadOnlyList<NamedCount>> ReadPagesAsync(DateOnly first, DateOnly last, CancellationToken cancellationToken) =>
        await InRange(first, last)
            .GroupBy(row => row.PageKey)
            .Select(group => new NamedCount(group.Key, group.Sum(row => (long)row.Views)))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

    public async Task<IReadOnlyList<DailyPageViews>> ReadDailyPagesAsync(DateOnly first, DateOnly last, CancellationToken cancellationToken) =>
        await InRange(first, last)
            .Where(row => row.Views > 0)
            .OrderBy(row => row.BusinessDay)
            .ThenBy(row => row.PageKey)
            .Select(row => new DailyPageViews(row.BusinessDay, row.PageKey, row.Views))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

    private IQueryable<DailyPageCount> InRange(DateOnly first, DateOnly last) =>
        context.DailyPageCounts.AsNoTracking().Where(row => row.BusinessDay >= first && row.BusinessDay <= last);

    /// <summary>One aggregate of a bucket: the day, or the month on its first day.</summary>
    private sealed record BucketFigure(int Year, int Month, int Day, long Value)
    {
        public DateOnly Start => new(Year, Month, Day);
    }
}
