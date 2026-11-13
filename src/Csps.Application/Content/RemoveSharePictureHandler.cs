using System.Globalization;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager takes the default link preview picture away (D-26, AUDIT-01). One transaction under the site-content lock clears
/// the five picture columns of the settings row, queues its file for removal and writes <c>site-settings.share-picture-changed</c> with
/// <c>removed</c>, never the address. Nothing calls the storage during the request; the file leaves it on the next cleanup run. No
/// version is sent: the removal applies to the latest state. The public cache is cleared after the commit by the data layer, so the next
/// page head has no picture and the small card.
/// </summary>
/// <param name="store">The business info store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="imageDeletions">The removal queue.</param>
public sealed class RemoveSharePictureHandler(ISiteContentStore store, ISiteContentLock siteLock, IAuditTrail audit, IUnitOfWork unitOfWork, IImageDeletionQueue imageDeletions)
{
    /// <summary>Removes the picture.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 404 when no picture is set, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(CancellationToken cancellationToken)
    {
        try
        {
            var outcome = await ConflictRetry
                .RunAsync(
                    () => unitOfWork.InTransactionAsync(AttemptAsync, cancellationToken),
                    Result.Failure<bool>(AuthErrors.SessionBusy))
                .ConfigureAwait(false);
            return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
        }
        catch (SiteContentBusyException)
        {
            return Result.Failure(AuthErrors.SessionBusy);
        }
    }

    private async Task<Result<bool>> AttemptAsync(CancellationToken cancellationToken)
    {
        await siteLock.TakeAsync(cancellationToken).ConfigureAwait(false);
        var current = await store.GetSettingsForUpdateAsync(cancellationToken).ConfigureAwait(false);
        if (current.Settings.RemoveSharePicture() is not { } old)
        {
            return Result.Failure<bool>(SiteContentErrors.SharePictureNotFound);
        }

        imageDeletions.Enqueue(old, ImageDeletionReason.PhotoDeleted);
        audit.Record(AuditActions.SharePictureChanged, SiteSettingsAuditDetail.TargetType, SiteSettings.SingletonId.ToString(CultureInfo.InvariantCulture), SiteSettingsAuditDetail.SharePictureChanged(SiteSettingsAuditDetail.SharePictureRemoved));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
