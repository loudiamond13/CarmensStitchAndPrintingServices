using Csps.Application.Images;
using Csps.Application.Orders;
using Csps.Application.Security;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.RateLimiting;

namespace Csps.Server.Controllers;

/// <summary>
/// The photos of a saved order (ORD-04, IMG-01): staff of either role add, arrange and delete them, and every answer is the whole order. Files reach the
/// image storage through the server only, never straight from the browser, and are held in memory, never on disk. Never cached.
/// </summary>
/// <param name="upload">The upload-a-photo handler.</param>
/// <param name="move">The move-a-photo handler.</param>
/// <param name="describe">The describe-a-photo handler.</param>
/// <param name="remove">The delete-a-photo handler.</param>
[ApiController]
[Route("api/v1/orders/{orderId:guid}/images")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class OrderImagesController(UploadOrderImageHandler upload, MoveOrderImageHandler move, DescribeOrderImageHandler describe, RemoveOrderImageHandler remove) : ControllerBase
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
    [EnableRateLimiting(RateLimitPolicies.ImageUpload)]
    [RequestSizeLimitMetadata(ImageUploadLimits.BodyBytes)]
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

    /// <summary>
    /// Moves one photo of a saved order to a place and shifts the others, with the order's version the page was opened with. Places
    /// count from 0 and the photo at place 0 is the cover, so "Make Cover" is this request with place 0. A place below 0 or at or
    /// above the photo count answers 400. A photo id that is not on this order answers 404 <c>orders.image-not-found</c>. A version
    /// that is not the stored one answers 409 <c>edit.stale</c> and changes nothing; a form save is never retried. A move to the place
    /// the photo already has changes nothing and keeps the version. A Completed or Cancelled order answers 422 <c>orders.locked</c>
    /// and changes nothing. A move is recorded in the audit log, and so is a change of cover.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="imageId">The photo id.</param>
    /// <param name="body">The place and the version; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 400 for field errors, 401 without a valid token, 404 when the order or the photo on it does not exist, 409 for a stale version, or 422 when the order is completed or cancelled (<c>orders.locked</c>).</returns>
    [HttpPut("{imageId:guid}/position")]
    [EndpointName("MoveOrderImage")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Move(
        Guid orderId,
        Guid imageId,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] MoveOrderImageRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await move.HandleAsync(orderId, imageId, body ?? MoveOrderImageRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }

    /// <summary>
    /// Sets or clears one photo's description on a saved order, with the order's version the page was opened with. The description
    /// is trimmed. An empty one, or exactly <c>Order {number} photo {place}</c> for the photo's current place, is kept as none, so
    /// the default text always follows the place; one over 200 characters (counted as .NET string length) answers 400 on
    /// <c>description</c>. A photo id that is not on this order answers 404 <c>orders.image-not-found</c>. A version that is not the
    /// stored one answers 409 <c>edit.stale</c> and changes nothing; a form save is never retried. A description that changes
    /// nothing saves nothing and keeps the version. A Completed or Cancelled order answers 422 <c>orders.locked</c> and changes
    /// nothing. A change is recorded in the audit log.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="imageId">The photo id.</param>
    /// <param name="body">The description and the version; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 400 for field errors, 401 without a valid token, 404 when the order or the photo on it does not exist, 409 for a stale version, or 422 when the order is completed or cancelled (<c>orders.locked</c>).</returns>
    [HttpPut("{imageId:guid}")]
    [EndpointName("DescribeOrderImage")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Describe(
        Guid orderId,
        Guid imageId,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] DescribeOrderImageRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await describe.HandleAsync(orderId, imageId, body ?? DescribeOrderImageRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }

    /// <summary>
    /// Deletes one photo of a saved order. No version is sent: the delete applies to the latest state, and a lost race is read again
    /// and decided again once. The other photos close up so the places stay 0 to n-1, and the next photo becomes the cover when the
    /// cover was deleted. A photo id that is not on this order, or was already deleted, answers 404 <c>orders.image-not-found</c>. A
    /// Completed or Cancelled order answers 422 <c>orders.locked</c> and changes nothing. The photo's file is queued for removal in the
    /// same save and leaves the storage on the next monthly cleanup run; nothing calls the storage during the request. The delete is
    /// recorded in the audit log.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="imageId">The photo id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 401 without a valid token, 404 when the order or the photo on it does not exist, 409 when two saves lost a race twice, or 422 when the order is completed or cancelled (<c>orders.locked</c>).</returns>
    [HttpDelete("{imageId:guid}")]
    [EndpointName("RemoveOrderImage")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Remove(Guid orderId, Guid imageId, CancellationToken cancellationToken)
    {
        var result = await remove.HandleAsync(orderId, imageId, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }
}
