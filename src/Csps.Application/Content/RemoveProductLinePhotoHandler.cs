using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager removes the photo in one slot of a product line (D-02, AUDIT-01). One transaction under the site-content lock
/// deletes the photo row, queues its file for removal and writes <c>product-line.photo-changed</c> with the line, the slot and
/// <c>removed</c>, never the address. A line delete or an upload at the same moment is decided one after the other. Nothing calls the
/// storage during the request; the file leaves it on the next cleanup run. No version is sent: the removal applies to the latest state.
/// </summary>
/// <param name="lines">The product line store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="imageDeletions">The removal queue.</param>
public sealed class RemoveProductLinePhotoHandler(IProductLines lines, ISiteContentLock siteLock, IAuditTrail audit, IUnitOfWork unitOfWork, IImageDeletionQueue imageDeletions)
{
    /// <summary>Removes the photo.</summary>
    /// <param name="lineId">The line.</param>
    /// <param name="slot">The slot to empty.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 404 when the line does not exist or the slot is already empty, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid lineId, ProductLinePhotoSlot slot, CancellationToken cancellationToken)
    {
        try
        {
            var outcome = await ConflictRetry
                .RunAsync(
                    () => unitOfWork.InTransactionAsync(token => AttemptAsync(lineId, slot, token), cancellationToken),
                    Result.Failure<bool>(AuthErrors.SessionBusy))
                .ConfigureAwait(false);
            return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
        }
        catch (SiteContentBusyException)
        {
            return Result.Failure(AuthErrors.SessionBusy);
        }
    }

    private async Task<Result<bool>> AttemptAsync(Guid lineId, ProductLinePhotoSlot slot, CancellationToken cancellationToken)
    {
        await siteLock.TakeAsync(cancellationToken).ConfigureAwait(false);
        var line = await lines.FindAsync(lineId, cancellationToken).ConfigureAwait(false);
        if (line is null)
        {
            return Result.Failure<bool>(SiteContentErrors.LineNotFound);
        }

        var photo = await lines.FindPhotoAsync(line.Id, slot, cancellationToken).ConfigureAwait(false);
        if (photo is null)
        {
            return Result.Failure<bool>(SiteContentErrors.PhotoNotFound);
        }

        lines.RemovePhoto(photo);
        imageDeletions.Enqueue(photo.PublicId, ImageDeletionReason.PhotoDeleted);
        audit.Record(AuditActions.ProductLinePhotoChanged, ProductLineAuditDetail.TargetType, AuditKey.Of(line.Id), ProductLineAuditDetail.PhotoChanged(line, slot, ProductLineAuditDetail.PhotoRemoved));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
