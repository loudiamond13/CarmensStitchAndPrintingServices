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
    public async Task EnqueueNowAsync(string publicId, ImageDeletionReason reason, CancellationToken cancellationToken)
    {
        try
        {
            var row = ImageDeletion.Queue(publicId, PrivateDelivery, reason, time.GetUtcNow());
            using var limit = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            limit.CancelAfter(WriteTimeout);
            var own = await contexts.CreateDbContextAsync(limit.Token).ConfigureAwait(false);
            await using (own.ConfigureAwait(false))
            {
                own.Set<ImageDeletion>().Add(row);
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
    public Task EnqueueManyNowAsync(IReadOnlyCollection<string> publicIds, ImageDeletionReason reason, CancellationToken cancellationToken) => Task.CompletedTask;

    /// <inheritdoc />
    public Task<IReadOnlyList<QueuedRemoval>> ClaimDueAsync(Guid holder, DateTimeOffset now, TimeSpan lease, int max, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<QueuedRemoval>>([]);

    /// <inheritdoc />
    public Task CompleteAsync(long id, Guid holder, CancellationToken cancellationToken) => Task.CompletedTask;

    /// <inheritdoc />
    public Task FailAsync(long id, Guid holder, string failureCode, DateTimeOffset now, CancellationToken cancellationToken) => Task.CompletedTask;

    /// <inheritdoc />
    public Task ReleaseAsync(IReadOnlyCollection<long> ids, Guid holder, CancellationToken cancellationToken) => Task.CompletedTask;

    [LoggerMessage(Level = LogLevel.Warning, Message = "A stored photo file could not be queued for removal. Code {FailureCode}.")]
    private static partial void LogQueueWriteFailed(ILogger logger, string failureCode);
}
