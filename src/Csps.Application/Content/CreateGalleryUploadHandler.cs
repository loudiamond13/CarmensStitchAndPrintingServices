using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Content;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager adds a photo of older work to the Gallery (GAL-03, D-10). The steps run in the order of the line photo upload, so
/// a refused upload never leaves a file in storage: the session must be usable (401), the storage set up (503), the form checked with
/// the photo present (400), the line must exist (400 on <c>productLineId</c>); then the file is read by its first bytes and held to the
/// size limits (400), its location and camera data is removed (400 when that cannot be done), and only then is it sent to the storage
/// under a random id in the entry's own content folder, never the orders folder. The entry is saved in one transaction under the
/// site-content lock at the top of the gallery, so a delete of the line at the same moment is a 400 or a 422 and never a 500. When the
/// entry cannot be saved after the file reached storage, the file is queued for removal as <c>UploadUndone</c> on its own short context
/// (JOB-02). A new upload is hidden unless the form says it is shown. The client file name and content type never shape the stored id.
/// </summary>
/// <param name="entries">The gallery store.</param>
/// <param name="lines">The product line store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="time">The clock.</param>
/// <param name="requestContext">The signed-in user of the request.</param>
/// <param name="storage">The image storage.</param>
/// <param name="imageDeletions">The removal queue.</param>
/// <param name="delivery">Makes the thumb address of the answer.</param>
/// <param name="settings">The upload limits.</param>
/// <param name="validator">The form rules.</param>
public sealed class CreateGalleryUploadHandler(
    IGalleryEntries entries,
    IProductLines lines,
    ISiteContentLock siteLock,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time,
    IRequestContext requestContext,
    IImageStorage storage,
    IImageDeletionQueue imageDeletions,
    IImageDelivery delivery,
    ImageUploadSettings settings,
    IValidator<GalleryUploadRequest> validator)
{
    /// <summary>The area name of gallery photos in the content folder.</summary>
    public const string Area = "gallery";

    /// <summary>Adds the upload.</summary>
    /// <param name="request">The form and the file.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The new item as the list shows it, a 400 when the form is wrong, the photo is missing or it is not a photo we can use, is too large
    /// or too big, a 401 when the token names no usable account, a 409 when two saves lost a race twice, or a 503 when photo storage is
    /// not set up or did not take the file.
    /// </returns>
    public async Task<Result<GalleryItemRowDto>> HandleAsync(CreateGalleryUploadRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<GalleryItemRowDto>(AuthErrors.SessionEnded);
        }

        if (!storage.IsConfigured)
        {
            return Result.Failure<GalleryItemRowDto>(ImageErrors.NotConfigured);
        }

        var context = new ValidationContext<GalleryUploadRequest>(request.Form);
        if (request.Bytes.IsEmpty)
        {
            context.RootContextData[GalleryUploadRequestValidator.PhotoMissingKey] = true;
        }

        var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<GalleryItemRowDto>(SiteContentErrors.Invalid(validation));
        }

        var lineId = request.Form.ProductLineId!.Value;
        var titles = await lines.GetTitlesAsync([lineId], cancellationToken).ConfigureAwait(false);
        if (titles.Count == 0)
        {
            return Result.Failure<GalleryItemRowDto>(SiteContentErrors.GalleryLineUnknown);
        }

        var inspected = ImageInspection.Check(request.Bytes, request.FileName, settings);
        if (inspected.IsFailure)
        {
            return Result.Failure<GalleryItemRowDto>(inspected.Error);
        }

        var facts = inspected.Value;
        var cleaned = ImageMetadataStripper.Strip(facts.Kind, request.Bytes.Span, request.FileName);
        if (cleaned.IsFailure)
        {
            return Result.Failure<GalleryItemRowDto>(cleaned.Error);
        }

        var clean = cleaned.Value;
        var entryId = GalleryEntry.NewId(time.GetUtcNow());
        var publicId = PublicIds.NewContent(storage.RootFolder, Area, entryId);
        var stored = await storage.UploadAsync(new ImageUpload(publicId, PublicIds.ContentFolder(storage.RootFolder, Area, entryId), clean, facts.Kind), cancellationToken).ConfigureAwait(false);
        if (!stored.Succeeded)
        {
            // A timeout or busy storage may have kept the file; queue it. A clear refusal stored nothing.
            if (stored.FailureCode == ImageFailureCodes.Transient)
            {
                await UndoUploadAsync(publicId).ConfigureAwait(false);
            }

            return Result.Failure<GalleryItemRowDto>(ImageErrors.StorageFailed);
        }

        var file = new LinePhotoFile(publicId, facts.UprightWidth, facts.UprightHeight, clean.Length, ImageKinds.Key(facts.Kind));
        var outcome = await SaveEntryAsync(request.Form.ToValues(), entryId, file, cancellationToken).ConfigureAwait(false);
        if (outcome.IsFailure)
        {
            return Result.Failure<GalleryItemRowDto>(outcome.Error);
        }

        var row = await entries.GetItemAsync(outcome.Value, cancellationToken).ConfigureAwait(false);
        return row is null
            ? Result.Failure<GalleryItemRowDto>(SiteContentErrors.GalleryItemNotFound)
            : Result.Success(GalleryItemRowDto.From(row, delivery));
    }

    // The file is already in storage here. Whatever stops the entry from being saved, the file is queued for removal on its own
    // context, with a token that cannot be cancelled so a dropped request still queues it (IMG-01). A failed queue write never hides the
    // original answer; the stray sweep is the backstop.
    private async Task<Result<Guid>> SaveEntryAsync(GalleryUploadValues values, Guid entryId, LinePhotoFile file, CancellationToken cancellationToken)
    {
        Result<Guid> outcome;
        try
        {
            outcome = await ConflictRetry
                .RunAsync(
                    () => unitOfWork.InTransactionAsync(token => AttemptAsync(values, entryId, file, token), cancellationToken),
                    Result.Failure<Guid>(AuthErrors.SessionBusy))
                .ConfigureAwait(false);
        }
        catch (SiteContentBusyException)
        {
            outcome = Result.Failure<Guid>(AuthErrors.SessionBusy);
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

    private async Task<Result<Guid>> AttemptAsync(GalleryUploadValues values, Guid entryId, LinePhotoFile file, CancellationToken cancellationToken)
    {
        await siteLock.TakeAsync(cancellationToken).ConfigureAwait(false);
        var titles = await lines.GetTitlesAsync([values.ProductLineId!.Value], cancellationToken).ConfigureAwait(false);
        if (!titles.TryGetValue(values.ProductLineId.Value, out var lineTitle))
        {
            return Result.Failure<Guid>(SiteContentErrors.GalleryLineUnknown);
        }

        var position = await entries.GetTopPositionAsync(cancellationToken).ConfigureAwait(false);
        var created = GalleryEntry.CreateUpload(entryId, values, file, position, time.GetUtcNow());
        if (created.IsFailure)
        {
            return Result.Failure<Guid>(created.Error);
        }

        var entry = created.Value;
        entries.Add(entry);
        audit.Record(AuditActions.GalleryPhotoAdded, GalleryAuditDetail.TargetType, AuditKey.Of(entry.Id), GalleryAuditDetail.Named(entry, lineTitle));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(entry.Id);
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
