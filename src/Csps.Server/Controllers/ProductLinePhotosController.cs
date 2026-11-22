using Csps.Application.Content;
using Csps.Application.Images;
using Csps.Application.Security;
using Csps.Domain.Common;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Csps.Server.Controllers;

/// <summary>
/// The photos of a product line (D-02): a Manager puts a photo into one of three slots, <c>main</c>, <c>back</c> or <c>fabric</c>, and
/// takes it out again. Files reach the image storage through the server only, never straight from the browser, and are held in memory,
/// never on disk. Never cached.
/// </summary>
/// <param name="upload">The upload handler.</param>
/// <param name="remove">The remove handler.</param>
[ApiController]
[Route("api/v1/product-lines/{lineId:guid}/photos/{slot}")]
[Authorize(Policy = Policies.Manager)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ProductLinePhotosController(UploadProductLinePhotoHandler upload, RemoveProductLinePhotoHandler remove) : ControllerBase
{
    /// <summary>
    /// Puts one photo into a slot of a product line as a multipart form with the file in the <c>file</c> part. The type is read from the
    /// first bytes of the file (JPG, PNG, WEBP or HEIC), never from its name or content type, and a file that is not a photo we can use,
    /// is over 10 MB or has too many pixels answers 400 and is never sent to storage. Location and camera data are removed. The photo is
    /// stored under a random id the client never chooses, in the line's own content folder. A slot that already holds a photo is
    /// replaced, and the old file is queued for removal in the same save. The slot is <c>main</c>, <c>back</c> or <c>fabric</c>; any
    /// other word answers 404. When photo storage is not set up the answer is 503 <c>images.not-configured</c>. A retry with the same
    /// <c>Idempotency-Key</c> and body answers with the stored answer and adds nothing more. Who added the photo and when come from the
    /// token and the clock. The change is recorded in the audit log with the slot and never the address, and the public pages show it at
    /// once.
    /// </summary>
    /// <param name="lineId">The product line id.</param>
    /// <param name="slot">The slot: <c>main</c>, <c>back</c> or <c>fabric</c>.</param>
    /// <param name="file">The photo.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the photo, 400 when there is no file or the file is not a photo we can use, 401 without a valid token, 403 for an Admin, 404 when the line or the slot word is unknown, 409 when two saves lost a race twice, 413 when the body is too large, 429 when the caller must slow down, or 503 when photo storage is not set up.</returns>
    [HttpPost]
    [EndpointName("UploadProductLinePhoto")]
    [EnableRateLimiting(RateLimitPolicies.ImageUpload)]
    [UploadSlot]
    [RequestSizeLimitMetadata(ImageUploadLimits.BodyBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = ImageUploadLimits.BodyBytes, MemoryBufferThreshold = ImageUploadLimits.BodyBytes + 1)]
    [ProducesResponseType<ProductLinePhotoDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IResult> UploadProductLinePhoto(Guid lineId, string slot, IFormFile? file, CancellationToken cancellationToken)
    {
        if (!ProductLinePhotoSlots.TryParse(slot, out var parsed))
        {
            return Result.Failure<ProductLinePhotoDto>(SiteContentErrors.PhotoNotFound).ToHttpResult(HttpContext, static photo => TypedResults.Ok(photo));
        }

        // The form limits above keep the whole body in memory, so this copy is bounded and never touches the disk.
        using var buffer = new MemoryStream((int)Math.Min(file?.Length ?? 0, ImageUploadLimits.BodyBytes));
        if (file is not null)
        {
            await file.CopyToAsync(buffer, cancellationToken).ConfigureAwait(false);
        }

        var request = new UploadProductLinePhotoRequest(lineId, parsed, buffer.GetBuffer().AsMemory(0, (int)buffer.Length), file?.FileName);
        var result = await upload.HandleAsync(request, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static photo => TypedResults.Ok(photo));
    }

    /// <summary>
    /// Takes the photo out of a slot. The slot then shows the drawn jersey or the empty placeholder again. The file is queued for removal
    /// in the same save and leaves the storage on the next daily cleanup run; nothing calls the storage during the request. The
    /// change is recorded in the audit log. A line or a slot word that does not exist, or a slot that is already empty, answers 404.
    /// </summary>
    /// <param name="lineId">The product line id.</param>
    /// <param name="slot">The slot: <c>main</c>, <c>back</c> or <c>fabric</c>.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when the line, the slot word or the photo does not exist, or 409 when two saves lost a race twice.</returns>
    [HttpDelete]
    [EndpointName("RemoveProductLinePhoto")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> RemoveProductLinePhoto(Guid lineId, string slot, CancellationToken cancellationToken)
    {
        if (!ProductLinePhotoSlots.TryParse(slot, out var parsed))
        {
            return Result.Failure(SiteContentErrors.PhotoNotFound).ToHttpResult(HttpContext, static () => TypedResults.NoContent());
        }

        var result = await remove.HandleAsync(lineId, parsed, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }
}
