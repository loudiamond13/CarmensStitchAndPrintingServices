using Csps.Application.Ports;
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
}
