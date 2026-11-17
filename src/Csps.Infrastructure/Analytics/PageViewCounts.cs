using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Analytics;

/// <summary><see cref="IPageViewCounts"/> over EF: one atomic update per view, so no view is lost when many arrive at once.</summary>
/// <param name="context">The database context.</param>
internal sealed class PageViewCounts(CspsDbContext context) : IPageViewCounts
{
    public async Task IncrementAsync(DateOnly day, string pageKey, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(pageKey);

        if (await AddOneAsync(day, pageKey, cancellationToken).ConfigureAwait(false) > 0)
        {
            return;
        }

        context.DailyPageCounts.Add(DailyPageCount.First(day, pageKey));
        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    private Task<int> AddOneAsync(DateOnly day, string pageKey, CancellationToken cancellationToken) =>
        context.DailyPageCounts
            .Where(row => row.BusinessDay == day && row.PageKey == pageKey)
            .ExecuteUpdateAsync(calls => calls.SetProperty(row => row.Views, row => row.Views + 1), cancellationToken);
}
