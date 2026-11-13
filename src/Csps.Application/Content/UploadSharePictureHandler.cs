using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager sets the default link preview picture (D-26, PUB-04). The steps run in the order of the line photo upload, so a
/// refused upload never leaves a file in storage: the session must be usable (401), the storage set up (503) and a file sent (400); then
/// the file is read by its first bytes and held to the size limits (400), its location and camera data is removed (400 when that cannot be
/// done), and only then is it sent to the storage under a new random id in the share folder of the content area, never the orders
/// folder. Every picture gets a new id, because Facebook keeps pictures by their address and would keep showing an old one. The settings
/// row is saved in one transaction under the site-content lock, and the file the row named before is queued for removal in the same
/// save. When the row cannot be saved after the file reached storage, the new file is queued for removal as <c>UploadUndone</c> on its
/// own short context (JOB-02). The client file name and content type never shape the stored id. The public cache is cleared after the
/// commit by the data layer, so the next page head carries the new address.
/// </summary>
/// <param name="store">The business info store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="requestContext">The signed-in user of the request.</param>
/// <param name="storage">The image storage.</param>
/// <param name="imageDeletions">The removal queue.</param>
/// <param name="delivery">Makes the preview addresses of the answer.</param>
/// <param name="settings">The upload limits.</param>
public sealed class UploadSharePictureHandler(
    ISiteContentStore store,
    ISiteContentLock siteLock,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IImageStorage storage,
    IImageDeletionQueue imageDeletions,
    IImageDelivery delivery,
    ImageUploadSettings settings)
{
    /// <summary>The area name of the share picture in the content folder.</summary>
    public const string Area = "share";

    /// <summary>Sets the picture.</summary>
    /// <param name="request">The file.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The picture as saved, a 400 when there is no file or it is not a photo we can use, is too large or too big, a 401 when the token
    /// names no usable account, a 409 when two saves lost a race twice, or a 503 when photo storage is not set up or did not take the file.
    /// </returns>
    public async Task<Result<SharePictureDto>> HandleAsync(UploadSharePictureRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<SharePictureDto>(AuthErrors.SessionEnded);
        }

        if (!storage.IsConfigured)
        {
            return Result.Failure<SharePictureDto>(ImageErrors.NotConfigured);
        }

        if (request.Bytes.IsEmpty)
        {
            return Result.Failure<SharePictureDto>(ImageErrors.FileMissing);
        }

        var inspected = ImageInspection.Check(request.Bytes, request.FileName, settings);
        if (inspected.IsFailure)
        {
            return Result.Failure<SharePictureDto>(inspected.Error);
        }

        var facts = inspected.Value;
        var cleaned = ImageMetadataStripper.Strip(facts.Kind, request.Bytes.Span, request.FileName);
        if (cleaned.IsFailure)
        {
            return Result.Failure<SharePictureDto>(cleaned.Error);
        }

        var clean = cleaned.Value;
        var publicId = PublicIds.NewContent(storage.RootFolder, Area, SiteSettings.SingletonGuid);
        var stored = await storage.UploadAsync(new ImageUpload(publicId, PublicIds.ContentFolder(storage.RootFolder, Area, SiteSettings.SingletonGuid), clean, facts.Kind), cancellationToken).ConfigureAwait(false);
        if (!stored.Succeeded)
        {
            // A timeout or busy storage may have kept the file; queue it. A clear refusal stored nothing.
            if (stored.FailureCode == ImageFailureCodes.Transient)
            {
                await UndoUploadAsync(publicId).ConfigureAwait(false);
            }

            return Result.Failure<SharePictureDto>(ImageErrors.StorageFailed);
        }

        var file = new LinePhotoFile(publicId, facts.UprightWidth, facts.UprightHeight, clean.Length, ImageKinds.Key(facts.Kind));
        var outcome = await SaveAsync(file, cancellationToken).ConfigureAwait(false);
        return outcome.IsFailure
            ? Result.Failure<SharePictureDto>(outcome.Error)
            : Result.Success(SharePictureDto.From(file.PublicId, file.Width, file.Height, delivery));
    }

    // The file is already in storage here. Whatever stops the settings row from being saved, the file is queued for removal on its own
    // context, with a token that cannot be cancelled so a dropped request still queues it (IMG-01). A failed queue write never hides the
    // original answer; the stray sweep is the backstop.
    private async Task<Result<bool>> SaveAsync(LinePhotoFile file, CancellationToken cancellationToken)
    {
        Result<bool> outcome;
        try
        {
            outcome = await ConflictRetry
                .RunAsync(
                    () => unitOfWork.InTransactionAsync(token => AttemptAsync(file, token), cancellationToken),
                    Result.Failure<bool>(AuthErrors.SessionBusy))
                .ConfigureAwait(false);
        }
        catch (SiteContentBusyException)
        {
            outcome = Result.Failure<bool>(AuthErrors.SessionBusy);
        }
        catch
        {
            await UndoUploadAsync(file.PublicId).ConfigureAwait(false);
            throw;
        }

        if (outcome.IsFailure)
        {
            await UndoUploadAsync(file.PublicId).ConfigureAwait(false);
        }

        return outcome;
    }

    private async Task<Result<bool>> AttemptAsync(LinePhotoFile file, CancellationToken cancellationToken)
    {
        await siteLock.TakeAsync(cancellationToken).ConfigureAwait(false);
        var current = await store.GetSettingsForUpdateAsync(cancellationToken).ConfigureAwait(false);

        // The old file leaves the storage with the next cleanup run, and only if this save goes through.
        if (current.Settings.SetSharePicture(file) is { } old)
        {
            imageDeletions.Enqueue(old, ImageDeletionReason.PhotoReplaced);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }

    private async Task UndoUploadAsync(string publicId)
    {
        try
        {
            await imageDeletions.EnqueueNowAsync(publicId, ImageDeletionReason.UploadUndone, CancellationToken.None).ConfigureAwait(false);
        }
        catch (Exception)
        {
            // The queue write logs its own failure code; the stray sweep removes the file later.
        }
    }
}
