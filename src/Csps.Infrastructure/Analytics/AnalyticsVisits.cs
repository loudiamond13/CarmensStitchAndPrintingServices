using System.Data;
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
    private const int StartAttempts = 5;

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

    public async Task<(Guid VisitId, bool Started)> StartUnlessCurrentAsync(AnalyticsVisit visit, DateTimeOffset since, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(visit);

        // A transaction the caller already opened could be weaker, so it is refused.
        if (context.Database.CurrentTransaction is not null)
        {
            throw new InvalidOperationException("Starting a visit opens its own serializable transaction and cannot run inside another transaction.");
        }

        // The find and the insert run as one serializable step, so a second caller waits and then finds the first caller's visit. Two callers
        // may lock each other out: the server picks one as the deadlock victim and that caller starts again, now finding the winner's visit.
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken).ConfigureAwait(false);
                await using (transaction.ConfigureAwait(false))
                {
                    var current = await FindCurrentAsync(visit.VisitorHash, since, cancellationToken).ConfigureAwait(false);
                    if (current is null)
                    {
                        context.AnalyticsVisits.Add(visit);
                        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                    }

                    await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
                    return current is { } existing ? (existing, false) : (visit.Id, true);
                }
            }
            catch (Exception error) when (attempt < StartAttempts && SqlErrors.Has(error, SqlErrors.DeadlockVictim))
            {
                context.Entry(visit).State = EntityState.Detached;
            }
        }
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
        await SaveUnlessVisitWasClearedAsync(cancellationToken).ConfigureAwait(false);
    }

    // The page views and speed samples go by the database cascade, so one delete removes everything linked to the visitor.
    public Task DeleteForVisitorAsync(byte[] visitorHash, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(visitorHash);

        return context.AnalyticsVisits
            .Where(visit => visit.VisitorHash == visitorHash)
            .ExecuteDeleteAsync(cancellationToken);
    }

    public async Task AddSamplesAsync(IReadOnlyList<AnalyticsVitalSample> samples, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(samples);

        if (samples.Count == 0)
        {
            return;
        }

        context.AnalyticsVitalSamples.AddRange(samples);
        await SaveUnlessVisitWasClearedAsync(cancellationToken).ConfigureAwait(false);
    }

    // The visitor may clear their data between the visit lookup and this insert. The missing visit then refuses the row, and the row is dropped.
    private async Task SaveUnlessVisitWasClearedAsync(CancellationToken cancellationToken)
    {
        try
        {
            await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (DbUpdateException error) when (SqlErrors.Has(error, SqlErrors.ForeignKeyViolation))
        {
            foreach (var entry in context.ChangeTracker.Entries().ToList())
            {
                entry.State = EntityState.Detached;
            }
        }
    }
}
