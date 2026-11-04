using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Images;

/// <summary>
/// The removal queue on EF Core (JOB-02, D-20). <see cref="Enqueue"/> only adds to the request's context, so the row is saved or
/// rolled back with the business change. <see cref="EnqueueNowAsync"/> writes on its own short context, so it survives a failed request.
/// </summary>
/// <param name="context">The scoped database context.</param>
/// <param name="contexts">Makes the short-lived context of <see cref="EnqueueNowAsync"/>.</param>
/// <param name="time">The clock.</param>
internal sealed class ImageDeletionQueue(CspsDbContext context, IDbContextFactory<CspsDbContext> contexts, TimeProvider time) : IImageDeletionQueue
{
    private const string PrivateDelivery = "private";

    /// <inheritdoc />
    public void Enqueue(string publicId, ImageDeletionReason reason)
    {
        // Compile shell: the row is not added yet.
        _ = (context, publicId, reason);
    }

    /// <inheritdoc />
    public Task EnqueueNowAsync(string publicId, ImageDeletionReason reason, CancellationToken cancellationToken)
    {
        _ = (contexts, time, PrivateDelivery, publicId, reason, cancellationToken);
        return Task.CompletedTask;
    }
}
