using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.Images;

/// <summary>
/// The removal queue on EF Core (JOB-02, D-20). <see cref="Enqueue"/> only adds to the request's context, so the row is saved or
/// rolled back with the business change. <see cref="EnqueueNowAsync"/> writes on its own short context, so it survives a failed request.
/// </summary>
/// <param name="context">The scoped database context.</param>
/// <param name="contexts">Makes the short-lived context of <see cref="EnqueueNowAsync"/>.</param>
/// <param name="time">The clock.</param>
/// <param name="log">Receives the failure code of a queue write that could not be saved.</param>
internal sealed class ImageDeletionQueue(CspsDbContext context, IDbContextFactory<CspsDbContext> contexts, TimeProvider time, ILogger<ImageDeletionQueue> log) : IImageDeletionQueue
{
    private const string PrivateDelivery = "private";

    /// <inheritdoc />
    public void Enqueue(string publicId, ImageDeletionReason reason) =>
        context.Set<ImageDeletion>().Add(ImageDeletion.Queue(publicId, PrivateDelivery, reason, time.GetUtcNow()));

    /// <inheritdoc />
    public Task EnqueueNowAsync(string publicId, ImageDeletionReason reason, CancellationToken cancellationToken)
    {
        // Compile shell until the own-context write is tested (Task 2).
        _ = (contexts, log, publicId, reason, cancellationToken);
        return Task.CompletedTask;
    }
}
