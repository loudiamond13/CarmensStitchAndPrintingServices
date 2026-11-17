using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Analytics;

/// <summary>
/// <see cref="IAnalyticsVisits"/> over EF (ANL-05). The page-view count and the last-seen time change through one atomic update, so
/// parallel page views of one visit lose nothing and the last-seen time never moves back.
/// </summary>
/// <param name="context">The database context.</param>
internal sealed class AnalyticsVisits(CspsDbContext context) : IAnalyticsVisits
{
    public Task<Guid?> FindCurrentAsync(byte[] visitorHash, DateTimeOffset since, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(visitorHash);

        return context.AnalyticsVisits
            .AsNoTracking()
            .Where(visit => visit.VisitorHash == visitorHash && visit.LastSeenAtUtc > since)
            .OrderByDescending(visit => visit.LastSeenAtUtc)
            .Select(visit => (Guid?)visit.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<Guid> StartAsync(AnalyticsVisit visit, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(visit);

        context.AnalyticsVisits.Add(visit);
        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return visit.Id;
    }

    public Task TouchAsync(Guid visitId, DateTimeOffset at, CancellationToken cancellationToken) =>
        context.AnalyticsVisits
            .Where(visit => visit.Id == visitId)
            .ExecuteUpdateAsync(
                calls => calls
                    .SetProperty(visit => visit.PageViews, visit => visit.PageViews + 1)
                    .SetProperty(visit => visit.LastSeenAtUtc, visit => visit.LastSeenAtUtc < at ? at : visit.LastSeenAtUtc),
                cancellationToken);

    public async Task AddPageViewAsync(AnalyticsPageView view, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(view);

        context.AnalyticsPageViews.Add(view);
        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    public Task DeleteForVisitorAsync(byte[] visitorHash, CancellationToken cancellationToken) =>
        throw new NotImplementedException();

    public async Task AddSamplesAsync(IReadOnlyList<AnalyticsVitalSample> samples, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(samples);

        if (samples.Count == 0)
        {
            return;
        }

        context.AnalyticsVitalSamples.AddRange(samples);
        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
