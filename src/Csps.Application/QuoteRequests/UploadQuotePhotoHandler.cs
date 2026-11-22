using System.Security.Cryptography;
using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.QuoteRequests;

namespace Csps.Application.QuoteRequests;

/// <summary>
/// Use case: an anonymous visitor sends one photo to a place their saved quote request declared (INQ-02, D-01). The request text was
/// saved first, so a photo that fails never loses it (D-03). The steps run in this order so a refused upload never leaves a customer
/// photo in storage: the storage must be set up (503), the file must be present (400), the request, its upload key, its expiry, its
/// status and the place must all fit (one 404 for every miss, CWE-639, CWE-203), then the file is read by its first bytes and held
/// to the size limits, its location and camera data is removed, and only then is it sent to the private storage under a random id
/// in the quotes folder. The place is filled with one conditional update that never touches the request row, so two photos of one
/// request can be saved at once. A visitor has no account, so the photo has no creator and no audit entry is written (SEC-08). When
/// the place cannot be filled after the file reached storage, the file is queued for removal as <c>UploadUndone</c> on its own short
/// context (JOB-02); so is a file whose upload ended with a lost reply.
/// </summary>
/// <param name="store">The quote request store.</param>
/// <param name="calendar">The business clock.</param>
/// <param name="storage">The private photo storage.</param>
/// <param name="imageDeletions">The queue of stored files to remove.</param>
/// <param name="settings">The photo limits.</param>
public sealed class UploadQuotePhotoHandler(
    IQuoteRequestStore store,
    IBusinessCalendar calendar,
    IImageStorage storage,
    IImageDeletionQueue imageDeletions,
    ImageUploadSettings settings)
{
    /// <summary>Stores the photo.</summary>
    /// <param name="requestId">The quote request id from the route.</param>
    /// <param name="slot">The place from the route.</param>
    /// <param name="request">The file and the upload key.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// Success when the photo is stored in its place; a 400 when there is no file or it is not a photo we can use; a 404 for every
    /// miss of the id, key, expiry, status or place; or a 503 when photo storage is not set up or did not take the file.
    /// </returns>
    public async Task<Result> HandleAsync(Guid requestId, int slot, UploadQuotePhotoRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (!storage.IsConfigured)
        {
            return Result.Failure(ImageErrors.NotConfigured);
        }

        if (request.Bytes.IsEmpty)
        {
            return Result.Failure(ImageErrors.FileMissing);
        }

        var target = await store.FindForUploadAsync(requestId, cancellationToken).ConfigureAwait(false);
        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        if (!IsAllowed(target, slot, request.UploadKey, clock.UtcNow))
        {
            return Result.Failure(QuoteRequestErrors.PhotoNotFound);
        }

        var inspected = ImageInspection.Check(request.Bytes, request.FileName, settings);
        if (inspected.IsFailure)
        {
            return Result.Failure(inspected.Error);
        }

        var facts = inspected.Value;
        var cleaned = ImageMetadataStripper.Strip(facts.Kind, request.Bytes.Span, request.FileName);
        if (cleaned.IsFailure)
        {
            return Result.Failure(cleaned.Error);
        }

        var clean = cleaned.Value;
        var publicId = PublicIds.NewQuote(storage.RootFolder, requestId);
        var stored = await storage.UploadAsync(new ImageUpload(publicId, PublicIds.QuoteFolder(storage.RootFolder, requestId), clean, facts.Kind), cancellationToken).ConfigureAwait(false);
        if (!stored.Succeeded)
        {
            // A timeout or busy storage may have kept the file; queue it. A clear refusal stored nothing.
            if (stored.FailureCode == ImageFailureCodes.Transient)
            {
                await UndoUploadAsync(publicId).ConfigureAwait(false);
            }

            return Result.Failure(ImageErrors.StorageFailed);
        }

        bool filled;
        try
        {
            var photo = new QuotePhotoStored(publicId, facts.UprightWidth, facts.UprightHeight, clean.Length, ImageKinds.Key(facts.Kind), clock.UtcNow);
            filled = await store.FillPhotoSlotAsync(requestId, slot, photo, cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            await UndoUploadAsync(publicId).ConfigureAwait(false);
            throw;
        }

        if (!filled)
        {
            // Another upload took the place first, or the request was marked Spam meanwhile: the stored file belongs to nobody.
            await UndoUploadAsync(publicId).ConfigureAwait(false);
            return Result.Failure(QuoteRequestErrors.PhotoNotFound);
        }

        return Result.Success();
    }

    // Every part is checked and one answer is given, so nothing tells which part was wrong. The key hashes are compared in fixed time.
    private static bool IsAllowed(QuotePhotoTarget? target, int slot, string? uploadKey, DateTimeOffset now)
    {
        var keyOk = QuoteUploadKey.TryHash(uploadKey, out var presented);
        if (target is null || target.UploadKeyHash is not { } stored || target.UploadKeyExpiresAtUtc is not { } expires)
        {
            return false;
        }

        var matches = keyOk && CryptographicOperations.FixedTimeEquals(presented, stored);
        return matches
            && now < expires
            && target.Status != QuoteRequestStatus.Spam
            && target.EmptySlots.Contains(slot);
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
