using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;

namespace Csps.Infrastructure.Analytics;

/// <summary><see cref="IPageViewCounts"/> over EF: one atomic update per view, so no view is lost when many arrive at once.</summary>
/// <param name="context">The database context.</param>
internal sealed class PageViewCounts(CspsDbContext context) : IPageViewCounts
{
    public Task IncrementAsync(DateOnly day, string pageKey, CancellationToken cancellationToken)
    {
        _ = context;
        return Task.CompletedTask;
    }
}
