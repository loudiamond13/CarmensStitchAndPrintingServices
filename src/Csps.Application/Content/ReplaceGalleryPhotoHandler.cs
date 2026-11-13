using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager puts a new photo in the place of a gallery upload's photo (GAL-03). The steps run in the order of the upload, so a
/// refused photo never leaves a file in storage: the session must be usable (401), the storage set up (503), a file sent (400 under
/// <c>file</c>) and the upload must exist (404; an order item takes its photos from the order); then the file is read by its first bytes
/// and held to the size limits (400), its location and camera data is removed, and only then is it sent to the storage under a random id
/// in the entry's own content folder. One transaction then puts the new file in the entry, queues the old file for removal and writes
/// <c>gallery-photo.changed</c> with <c>fields=photo</c>, never the address. When the entry cannot be saved after the file reached
/// storage, the new file is queued as <c>UploadUndone</c> on its own short context (JOB-02). No version is sent: a replace applies to the
/// latest state, and the answer carries the new version.
/// </summary>
/// <param name="entries">The gallery store.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="requestContext">The signed-in user of the request.</param>
/// <param name="storage">The image storage.</param>
/// <param name="imageDeletions">The removal queue.</param>
/// <param name="delivery">Makes the thumb address of the answer.</param>
/// <param name="settings">The upload limits.</param>
public sealed class ReplaceGalleryPhotoHandler(
    IGalleryEntries entries,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IImageStorage storage,
    IImageDeletionQueue imageDeletions,
    IImageDelivery delivery,
    ImageUploadSettings settings)
{
    /// <summary>Replaces the photo.</summary>
    /// <param name="id">The upload.</param>
    /// <param name="bytes">The file bytes; empty when no file was sent.</param>
    /// <param name="fileName">The client's file name, used only in messages.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The item as saved, a 400 when there is no file or it is not a photo we can use, a 401, a 404, a 409 when two saves lost a race twice, or a 503 when photo storage is not set up or did not take the file.</returns>
    public async Task<Result<GalleryItemRowDto>> HandleAsync(Guid id, ReadOnlyMemory<byte> bytes, string? fileName, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is null)
        {
            return Result.Failure<GalleryItemRowDto>(AuthErrors.SessionEnded);
        }

        if (!storage.IsConfigured)
        {
            return Result.Failure<GalleryItemRowDto>(ImageErrors.NotConfigured);
        }

        if (bytes.IsEmpty)
        {
            return Result.Failure<GalleryItemRowDto>(SiteContentErrors.GalleryPhotoMissing);
        }

        var existing = await entries.GetItemAsync(id, cancellationToken).ConfigureAwait(false);
        if (existing is not { Kind: GalleryEntryKind.Upload })
        {
            return Result.Failure<GalleryItemRowDto>(SiteContentErrors.GalleryItemNotFound);
        }

        var inspected = ImageInspection.Check(bytes, fileName, settings);
        if (inspected.IsFailure)
        {
            return Result.Failure<GalleryItemRowDto>(inspected.Error);
        }

        var facts = inspected.Value;
        var cleaned = ImageMetadataStripper.Strip(facts.Kind, bytes.Span, fileName);
        if (cleaned.IsFailure)
        {
            return Result.Failure<GalleryItemRowDto>(cleaned.Error);
        }

        var clean = cleaned.Value;
        var publicId = PublicIds.NewContent(storage.RootFolder, CreateGalleryUploadHandler.Area, id);
        var stored = await storage.UploadAsync(new ImageUpload(publicId, PublicIds.ContentFolder(storage.RootFolder, CreateGalleryUploadHandler.Area, id), clean, facts.Kind), cancellationToken).ConfigureAwait(false);
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
        var outcome = await SaveAsync(id, file, cancellationToken).ConfigureAwait(false);
        if (outcome.IsFailure)
        {
            return Result.Failure<GalleryItemRowDto>(outcome.Error);
        }

        var row = await entries.GetItemAsync(id, cancellationToken).ConfigureAwait(false);
        return row is null
            ? Result.Failure<GalleryItemRowDto>(SiteContentErrors.GalleryItemNotFound)
            : Result.Success(GalleryItemRowDto.From(row, delivery));
    }

    // The new file is already in storage here. Whatever stops the entry from being saved, the new file is queued for removal on its own
    // context, with a token that cannot be cancelled so a dropped request still queues it (IMG-01).
    private async Task<Result<bool>> SaveAsync(Guid id, LinePhotoFile file, CancellationToken cancellationToken)
    {
        Result<bool> outcome;
        try
        {
            outcome = await ConflictRetry
                .RunAsync(
                    () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, file, token), cancellationToken),
                    Result.Failure<bool>(AuthErrors.SessionBusy))
                .ConfigureAwait(false);
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

    private async Task<Result<bool>> AttemptAsync(Guid id, LinePhotoFile file, CancellationToken cancellationToken)
    {
        var entry = await entries.FindUploadAsync(id, cancellationToken).ConfigureAwait(false);
        if (entry is null)
        {
            return Result.Failure<bool>(SiteContentErrors.GalleryItemNotFound);
        }

        // The old file leaves the storage with the next cleanup run, and only if this save goes through.
        imageDeletions.Enqueue(entry.ReplacePhoto(file), ImageDeletionReason.PhotoReplaced);
        audit.Record(AuditActions.GalleryPhotoChanged, GalleryAuditDetail.TargetType, AuditKey.Of(entry.Id), GalleryAuditDetail.PhotoReplaced);
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
