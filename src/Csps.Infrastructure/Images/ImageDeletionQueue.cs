using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.Images;

/// <summary>
/// The removal queue on EF Core (JOB-02, D-20). <see cref="Enqueue"/> only adds to the request's context, so the row is saved or
/// rolled back with the business change. <see cref="EnqueueNowAsync"/> writes on its own short context, so it survives a failed request;
/// it gives up after a short wait and logs only a failure code.
/// </summary>
/// <param name="context">The scoped database context.</param>
/// <param name="contexts">Makes the short-lived context of <see cref="EnqueueNowAsync"/>.</param>
/// <param name="time">The clock.</param>
/// <param name="log">Receives the failure code of a queue write that could not be saved.</param>
internal sealed partial class ImageDeletionQueue(CspsDbContext context, IDbContextFactory<CspsDbContext> contexts, TimeProvider time, ILogger<ImageDeletionQueue> log) : IImageDeletionQueue
{
    private const string PrivateDelivery = "private";
    private const string WriteFailedCode = "image-queue-failed";

    private static readonly TimeSpan WriteTimeout = TimeSpan.FromSeconds(10);

    /// <inheritdoc />
    public void Enqueue(string publicId, ImageDeletionReason reason) =>
        context.Set<ImageDeletion>().Add(ImageDeletion.Queue(publicId, PrivateDelivery, reason, time.GetUtcNow()));

    /// <inheritdoc />
    public Task EnqueueNowAsync(string publicId, ImageDeletionReason reason, CancellationToken cancellationToken) =>
        EnqueueManyNowAsync([publicId], reason, cancellationToken);

    /// <inheritdoc />
    public async Task EnqueueManyNowAsync(IReadOnlyCollection<string> publicIds, ImageDeletionReason reason, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(publicIds);
        if (publicIds.Count == 0)
        {
            return;
        }

        try
        {
            var now = time.GetUtcNow();
            var rows = publicIds.Select(publicId => ImageDeletion.Queue(publicId, PrivateDelivery, reason, now)).ToList();
            using var limit = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            limit.CancelAfter(WriteTimeout);
            var own = await contexts.CreateDbContextAsync(limit.Token).ConfigureAwait(false);
            await using (own.ConfigureAwait(false))
            {
                own.Set<ImageDeletion>().AddRange(rows);
                await own.SaveChangesAsync(limit.Token).ConfigureAwait(false);
            }
        }
        catch (Exception)
        {
            // Only the code is logged, never the file id. The caller decides whether the failure matters.
            LogQueueWriteFailed(log, WriteFailedCode);
            throw;
        }
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<QueuedRemoval>> ClaimDueAsync(Guid holder, DateTimeOffset now, TimeSpan lease, int max, CancellationToken cancellationToken)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(max, 1);

        var leaseEnd = now + lease;
        var candidates = await context.Set<ImageDeletion>()
            .AsNoTracking()
            .Where(row => row.NextAttemptAtUtc <= now && (row.LeaseUntilUtc == null || row.LeaseUntilUtc < now))
            .OrderBy(row => row.NextAttemptAtUtc)
            .ThenBy(row => row.Id)
            .Take(max)
            .Select(row => new QueuedRemoval(row.Id, row.PublicId, row.Attempts))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        // Each row is taken by its own conditional update: a result of 1 means this run owns it, 0 means another run got there first.
        var owned = new List<QueuedRemoval>(candidates.Count);
        foreach (var candidate in candidates)
        {
            var taken = await context.Set<ImageDeletion>()
                .Where(row => row.Id == candidate.Id && row.NextAttemptAtUtc <= now && (row.LeaseUntilUtc == null || row.LeaseUntilUtc < now))
                .ExecuteUpdateAsync(
                    calls => calls
                        .SetProperty(row => row.LeaseUntilUtc, (DateTimeOffset?)leaseEnd)
                        .SetProperty(row => row.LeaseHolder, (Guid?)holder),
                    cancellationToken)
                .ConfigureAwait(false);
            if (taken == 1)
            {
                owned.Add(candidate);
            }
        }

        return owned;
    }

    /// <inheritdoc />
    public async Task CompleteAsync(long id, Guid holder, CancellationToken cancellationToken) =>
        await context.Set<ImageDeletion>()
            .Where(row => row.Id == id && row.LeaseHolder == holder)
            .ExecuteDeleteAsync(cancellationToken)
            .ConfigureAwait(false);

    /// <inheritdoc />
    public async Task FailAsync(long id, Guid holder, string failureCode, DateTimeOffset now, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(failureCode);

        var code = failureCode.Length > ImageDeletion.FailureCodeMaxLength ? failureCode[..ImageDeletion.FailureCodeMaxLength] : failureCode;
        await context.Set<ImageDeletion>()
            .Where(row => row.Id == id && row.LeaseHolder == holder)
            .ExecuteUpdateAsync(
                calls => calls
                    .SetProperty(row => row.Attempts, row => row.Attempts + 1)
                    .SetProperty(row => row.LastFailureCode, code)
                    .SetProperty(row => row.LastFailedAtUtc, (DateTimeOffset?)now)
                    .SetProperty(row => row.NextAttemptAtUtc, now)
                    .SetProperty(row => row.LeaseUntilUtc, (DateTimeOffset?)null)
                    .SetProperty(row => row.LeaseHolder, (Guid?)null),
                cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task ReleaseAsync(IReadOnlyCollection<long> ids, Guid holder, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ids);
        if (ids.Count == 0)
        {
            return;
        }

        var idList = ids.ToList();
        await context.Set<ImageDeletion>()
            .Where(row => idList.Contains(row.Id) && row.LeaseHolder == holder)
            .ExecuteUpdateAsync(
                calls => calls
                    .SetProperty(row => row.LeaseUntilUtc, (DateTimeOffset?)null)
                    .SetProperty(row => row.LeaseHolder, (Guid?)null),
                cancellationToken)
            .ConfigureAwait(false);
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "A stored photo file could not be queued for removal. Code {FailureCode}.")]
    private static partial void LogQueueWriteFailed(ILogger logger, string failureCode);
}
