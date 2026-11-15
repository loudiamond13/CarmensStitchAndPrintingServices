using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager deletes a gallery upload for good (GAL-03). One transaction removes the entry, queues its photo for removal and
/// writes <c>gallery-photo.deleted</c> with the team and the line title, never the address. Nothing calls the storage during the request;
/// the file leaves it on the next cleanup run. An upload that is gone, or an order item, is a 404: an order item is taken off the website
/// from its order. No version is sent: the delete applies to the latest state, so a lost race is read again and decided again.
/// </summary>
/// <param name="entries">The gallery store.</param>
/// <param name="lines">The product line store.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="imageDeletions">The removal queue.</param>
public sealed class DeleteGalleryUploadHandler(IGalleryEntries entries, IProductLines lines, IAuditTrail audit, IUnitOfWork unitOfWork, IImageDeletionQueue imageDeletions)
{
    /// <summary>Deletes the upload.</summary>
    /// <param name="id">The upload to delete.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 404 when the upload does not exist or is an order item, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, token), cancellationToken),
                Result.Failure<bool>(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
        return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, CancellationToken cancellationToken)
    {
        var entry = await entries.FindUploadAsync(id, cancellationToken).ConfigureAwait(false);
        if (entry is null)
        {
            return Result.Failure<bool>(SiteContentErrors.GalleryItemNotFound);
        }

        var titles = await lines.GetTitlesAsync([entry.ProductLineId!.Value], cancellationToken).ConfigureAwait(false);
        var title = titles.TryGetValue(entry.ProductLineId.Value, out var found) ? found : string.Empty;
        audit.Record(AuditActions.GalleryPhotoDeleted, GalleryAuditDetail.TargetType, AuditKey.Of(entry.Id), GalleryAuditDetail.Named(entry, title));
        imageDeletions.Enqueue(entry.PublicId!, ImageDeletionReason.PhotoDeleted);
        entries.Remove(entry);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
