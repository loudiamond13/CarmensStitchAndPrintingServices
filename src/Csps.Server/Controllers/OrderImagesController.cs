using Csps.Application.Images;
using Csps.Application.Orders;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// The photos of a saved order (ORD-04, IMG-01): staff of either role add them, and every answer is the whole order. Files reach the
/// image storage through the server only, never straight from the browser, and are held in memory, never on disk. Never cached.
/// </summary>
/// <param name="upload">The upload-a-photo handler.</param>
[ApiController]
[Route("api/v1/orders/{orderId:guid}/images")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class OrderImagesController(UploadOrderImageHandler upload) : ControllerBase
{
    /// <summary>
    /// Uploads one photo to a saved order as a multipart form with the file in the <c>file</c> part and an optional <c>description</c>
    /// part. The type is read from the first bytes of the file (JPG, PNG, WEBP or HEIC), never from its name or content type, and a
    /// file that is not a photo we can use answers 400 and is never sent to storage. The description is trimmed; an empty one, or the
    /// default text, is kept as none, and one over 200 characters answers 400. An order holds at most 5 photos: a sixth answers 422
    /// <c>orders.images-full</c>. A Completed or Cancelled order answers 422 <c>orders.locked</c> and changes nothing. The photo is
    /// stored under a random id the client never chooses. When photo storage is not set up the answer is 503
    /// <c>images.not-configured</c>. A retry with the same <c>Idempotency-Key</c> and body answers with the stored answer and adds
    /// nothing more. Who added the photo and when come from the token and the clock.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="file">The photo.</param>
    /// <param name="description">The optional description, up to 200 characters.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 400 when there is no file, the file is not a photo we can use or the description is too long, 401 without a valid token, 404 when the order does not exist or was deleted, 409 when two saves lost a race twice, 413 when the body is too large, 422 when the order already has 5 photos or is completed or cancelled (<c>orders.locked</c>), 429 when the caller must slow down, or 503 when photo storage is not set up.</returns>
    [HttpPost]
    [EndpointName("UploadOrderImage")]
    [RequestFormLimits(MultipartBodyLengthLimit = ImageUploadLimits.BodyBytes, MemoryBufferThreshold = ImageUploadLimits.BodyBytes + 1)]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IResult> Upload(
        Guid orderId,
        IFormFile? file,
        [FromForm] string? description,
        CancellationToken cancellationToken)
    {
        // The form limits above keep the whole body in memory, so this copy is bounded and never touches the disk.
        using var buffer = new MemoryStream((int)Math.Min(file?.Length ?? 0, ImageUploadLimits.BodyBytes));
        if (file is not null)
        {
            await file.CopyToAsync(buffer, cancellationToken).ConfigureAwait(false);
        }

        var request = new UploadOrderImageRequest(buffer.GetBuffer().AsMemory(0, (int)buffer.Length), file?.FileName, description);
        var result = await upload.HandleAsync(orderId, request, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }
}
