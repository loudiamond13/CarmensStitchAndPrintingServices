using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager puts a photo into one of the three slots of a product line (D-02, IMG-01, IMG-03). The steps run in the order of
/// the order photo upload, so a refused upload never leaves a file in storage: the session must be usable (401), the storage set up (503),
/// a file sent (400) and the line must exist (404); then the file is read by its first bytes and held to the size limits (400), its
/// location and camera data is removed (400 when that cannot be done), and only then is it sent to the storage under a random id in the
/// line's content folder, never the orders folder. The photo row is saved in one transaction under the site-content lock, so a delete of the
/// line at the same moment is a 404 or a 422 and never a 500 (the line-in-use rule of plan 11-17). When the row cannot be saved after the
/// file reached storage, the file is queued for removal as <c>UploadUndone</c> on its own short context (JOB-02). The client file name
/// and content type never shape the stored id.
/// </summary>
/// <param name="lines">The product line store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="time">The clock.</param>
/// <param name="requestContext">The signed-in user of the request.</param>
/// <param name="storage">The image storage.</param>
/// <param name="imageDeletions">The removal queue.</param>
/// <param name="delivery">Makes the preview addresses of the answer.</param>
/// <param name="settings">The upload limits.</param>
public sealed class UploadProductLinePhotoHandler(
    IProductLines lines,
    ISiteContentLock siteLock,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time,
    IRequestContext requestContext,
    IImageStorage storage,
    IImageDeletionQueue imageDeletions,
    IImageDelivery delivery,
    ImageUploadSettings settings)
{
    /// <summary>The area name of line photos in the content folder.</summary>
    public const string Area = "lines";

    /// <summary>Uploads the photo.</summary>
    /// <param name="request">The line, the slot and the file.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The photo as saved, a 400 when there is no file or it is not a photo we can use, is too large or too big, a 401 when the token names
    /// no usable account, a 404 when the line does not exist, a 409 when two saves lost a race twice, or a 503 when photo storage is not
    /// set up or did not take the file.
    /// </returns>
    public async Task<Result<ProductLinePhotoDto>> HandleAsync(UploadProductLinePhotoRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<ProductLinePhotoDto>(AuthErrors.SessionEnded);
        }

        if (!storage.IsConfigured)
        {
            return Result.Failure<ProductLinePhotoDto>(ImageErrors.NotConfigured);
        }

        if (request.Bytes.IsEmpty)
        {
            return Result.Failure<ProductLinePhotoDto>(ImageErrors.FileMissing);
        }

        var titles = await lines.GetTitlesAsync([request.LineId], cancellationToken).ConfigureAwait(false);
        if (titles.Count == 0)
        {
            return Result.Failure<ProductLinePhotoDto>(SiteContentErrors.LineNotFound);
        }

        var inspected = ImageInspection.Check(request.Bytes, request.FileName, settings);
        if (inspected.IsFailure)
        {
            return Result.Failure<ProductLinePhotoDto>(inspected.Error);
        }

        var facts = inspected.Value;
        var cleaned = ImageMetadataStripper.Strip(facts.Kind, request.Bytes.Span, request.FileName);
        if (cleaned.IsFailure)
        {
            return Result.Failure<ProductLinePhotoDto>(cleaned.Error);
        }

        var clean = cleaned.Value;
        var publicId = PublicIds.NewContent(storage.RootFolder, Area, request.LineId);
        var stored = await storage.UploadAsync(new ImageUpload(publicId, PublicIds.ContentFolder(storage.RootFolder, Area, request.LineId), clean, facts.Kind), cancellationToken).ConfigureAwait(false);
        if (!stored.Succeeded)
        {
            // A timeout or busy storage may have kept the file; queue it. A clear refusal stored nothing.
            if (stored.FailureCode == ImageFailureCodes.Transient)
            {
                await UndoUploadAsync(publicId).ConfigureAwait(false);
            }

            return Result.Failure<ProductLinePhotoDto>(ImageErrors.StorageFailed);
        }

        var file = new LinePhotoFile(publicId, facts.UprightWidth, facts.UprightHeight, clean.Length, ImageKinds.Key(facts.Kind));
        var outcome = await SavePhotoAsync(request, file, cancellationToken).ConfigureAwait(false);
        return outcome.IsFailure
            ? Result.Failure<ProductLinePhotoDto>(outcome.Error)
            : Result.Success(ProductLinePhotoMapper.ToAdmin(outcome.Value, delivery));
    }

    // The file is already in storage here. Whatever stops the photo row from being saved, the file is queued for removal on its own
    // context, with a token that cannot be cancelled so a dropped request still queues it (IMG-01). A failed queue write never hides the
    // original answer; the stray sweep is the backstop.
    private async Task<Result<ProductLinePhoto>> SavePhotoAsync(UploadProductLinePhotoRequest request, LinePhotoFile file, CancellationToken cancellationToken)
    {
        Result<ProductLinePhoto> outcome;
        try
        {
            outcome = await ConflictRetry
                .RunAsync(
                    () => unitOfWork.InTransactionAsync(token => AttemptAsync(request, file, token), cancellationToken),
                    Result.Failure<ProductLinePhoto>(AuthErrors.SessionBusy))
                .ConfigureAwait(false);
        }
        catch (SiteContentBusyException)
        {
            outcome = Result.Failure<ProductLinePhoto>(AuthErrors.SessionBusy);
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

    private async Task<Result<ProductLinePhoto>> AttemptAsync(UploadProductLinePhotoRequest request, LinePhotoFile file, CancellationToken cancellationToken)
    {
        await siteLock.TakeAsync(cancellationToken).ConfigureAwait(false);
        var line = await lines.FindAsync(request.LineId, cancellationToken).ConfigureAwait(false);
        if (line is null)
        {
            return Result.Failure<ProductLinePhoto>(SiteContentErrors.LineNotFound);
        }

        var photo = await lines.FindPhotoAsync(line.Id, request.Slot, cancellationToken).ConfigureAwait(false);
        string change;
        if (photo is null)
        {
            photo = ProductLinePhoto.Create(line.Id, request.Slot, file, time.GetUtcNow());
            lines.AddPhoto(photo);
            change = ProductLineAuditDetail.PhotoAdded;
        }
        else
        {
            // The old file leaves the storage with the next cleanup run, and only if this save goes through.
            imageDeletions.Enqueue(photo.Replace(file), ImageDeletionReason.PhotoReplaced);
            change = ProductLineAuditDetail.PhotoReplaced;
        }

        audit.Record(AuditActions.ProductLinePhotoChanged, ProductLineAuditDetail.TargetType, AuditKey.Of(line.Id), ProductLineAuditDetail.PhotoChanged(line, request.Slot, change));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(photo);
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
