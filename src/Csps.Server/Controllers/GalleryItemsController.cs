using System.Globalization;
using Csps.Application.Content;
using Csps.Application.Images;
using Csps.Application.Security;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.RateLimiting;

namespace Csps.Server.Controllers;

/// <summary>
/// Staff API for the public Gallery (GAL-03, D-10): Managers only. The list holds every shown order and every upload in the one gallery
/// order; an upload is added with a photo, edited, hidden, shown and deleted here, and an order item is changed on its order page.
/// Files reach the image storage through the server only, never straight from the browser, and are held in memory, never on disk.
/// Never cached.
/// </summary>
/// <param name="list">The list handler.</param>
/// <param name="create">The add handler.</param>
/// <param name="update">The edit handler.</param>
/// <param name="replacePhoto">The photo replace handler.</param>
/// <param name="move">The move handler.</param>
/// <param name="setShown">The hide and show handler.</param>
/// <param name="delete">The delete handler.</param>
[ApiController]
[Route("api/v1/gallery-items")]
[Authorize(Policy = Policies.Manager)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class GalleryItemsController(
    ListGalleryItemsHandler list,
    CreateGalleryUploadHandler create,
    UpdateGalleryUploadHandler update,
    ReplaceGalleryPhotoHandler replacePhoto,
    MoveGalleryItemHandler move,
    SetGalleryUploadShownHandler setShown,
    DeleteGalleryUploadHandler delete) : ControllerBase
{
    /// <summary>
    /// Lists the gallery in gallery order, one page at a time: every upload (shown or hidden) and every order that is shown. Each row
    /// has its kind (<c>order</c> or <c>upload</c>), the name shown, the line and the short name of the line, whether the line is
    /// hidden (the item is then off the public site), the pieces, whether it is shown, the order id and number of an order item, the
    /// note and the version of an upload, and a small photo address. A page past the last answers no rows and the real total.
    /// </summary>
    /// <param name="line">A product line id; none means every line.</param>
    /// <param name="page">The page number, from 1 to 100000.</param>
    /// <param name="pageSize">Rows per page, from 1 to 100; 20 when not sent.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the page, 400 for a bad line, page or size, 401 without a valid token, or 403 for an Admin.</returns>
    [HttpGet]
    [EndpointName("ListGalleryItems")]
    [ProducesResponseType<GalleryItemListDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> ListGalleryItems(
        [FromQuery] string? line,
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = ListGalleryItemsRequest.DefaultPageSize)
    {
        var result = await list.HandleAsync(new ListGalleryItemsRequest(line, page, pageSize), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static items => TypedResults.Ok(items));
    }

    /// <summary>
    /// Adds a photo of older work to the Gallery as a multipart form with the file in the <c>file</c> part and the fields
    /// <c>teamName</c>, <c>productLineId</c>, <c>pieces</c> (optional), <c>note</c> (optional) and <c>isShown</c> as form parts. The type is read from
    /// the first bytes of the file (JPG, PNG, WEBP or HEIC), never from its name or content type, and a file that is not a photo we can
    /// use, is over 10 MB or has too many pixels answers 400 and is never sent to storage. Location and camera data are removed. The
    /// photo is stored under a random id the client never chooses, in the entry's own content folder. The upload joins at the top of
    /// the gallery. It is hidden unless <c>isShown</c> is <c>true</c>, and a line that is hidden keeps it off the public site. When photo
    /// storage is not set up the answer is 503 <c>images.not-configured</c>. A retry with the same <c>Idempotency-Key</c> and body
    /// answers with the stored answer and adds nothing more. Who added it and when come from the token and the clock. The change is
    /// recorded in the audit log without the address, and the public pages show it at once.
    /// </summary>
    /// <param name="file">The photo.</param>
    /// <param name="teamName">The team or name shown, at most 80 characters.</param>
    /// <param name="productLineId">The line the upload is filed under.</param>
    /// <param name="pieces">The pieces, a whole number from 1 to 9,999; blank for none.</param>
    /// <param name="note">The note, at most 120 characters; blank for none.</param>
    /// <param name="isShown"><c>true</c> to show it on the website.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>201 with the new item, 400 for field errors or a file that is not a photo we can use, 401 without a valid token, 403 for an Admin, 409 when two saves lost a race twice, 413 when the body is too large, 429 when the caller must slow down, or 503 when photo storage is not set up.</returns>
    [HttpPost]
    [EndpointName("CreateGalleryUpload")]
    [EnableRateLimiting(RateLimitPolicies.ImageUpload)]
    [UploadSlot]
    [RequestSizeLimitMetadata(ImageUploadLimits.BodyBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = ImageUploadLimits.BodyBytes, MemoryBufferThreshold = ImageUploadLimits.BodyBytes + 1)]
    [ProducesResponseType<GalleryItemRowDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IResult> CreateGalleryUpload(
        IFormFile? file,
        [FromForm] string? teamName,
        [FromForm] string? productLineId,
        [FromForm] string? pieces,
        [FromForm] string? note,
        [FromForm] string? isShown,
        CancellationToken cancellationToken)
    {
        // The form limits above keep the whole body in memory, so this copy is bounded and never touches the disk.
        using var buffer = new MemoryStream((int)Math.Min(file?.Length ?? 0, ImageUploadLimits.BodyBytes));
        if (file is not null)
        {
            await file.CopyToAsync(buffer, cancellationToken).ConfigureAwait(false);
        }

        var form = ReadForm(teamName, productLineId, pieces, note, isShown, version: null);
        var request = new CreateGalleryUploadRequest(form, buffer.GetBuffer().AsMemory(0, (int)buffer.Length), file?.FileName);
        var result = await create.HandleAsync(request, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static item => TypedResults.Created("/api/v1/gallery-items", item));
    }

    /// <summary>
    /// Edits an upload with the version the form was opened with, as JSON: <c>teamName</c>, <c>productLineId</c>, <c>pieces</c>,
    /// <c>note</c>, <c>isShown</c> and <c>version</c>. The values follow the same rules as when adding. A <c>version</c> that is not the
    /// stored one answers 409 <c>edit.stale</c> and changes nothing; a form edit is never retried. A form with no change stores nothing
    /// and keeps the version. The photo is replaced through its own route. An item that came from an order answers 404: it is changed on
    /// its order. Who changed it and when come from the token and the clock; any such member in the body is ignored.
    /// </summary>
    /// <param name="id">The gallery entry id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the saved item, 400 for field errors, 401 without a valid token, 403 for an Admin, 404 when it does not exist or is an order item, or 409 for a stale version or a lost race.</returns>
    [HttpPut("{id:guid}")]
    [EndpointName("UpdateGalleryUpload")]
    [ProducesResponseType<GalleryItemRowDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> UpdateGalleryUpload(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] GalleryUploadRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await update.HandleAsync(id, body ?? GalleryUploadRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static item => TypedResults.Ok(item));
    }

    /// <summary>
    /// Puts a new photo in the place of an upload's photo, as a multipart form with the file in the <c>file</c> part. The file is held
    /// to the same rules as when adding (type read from the first bytes, 10 MB, 25 megapixels, location and camera data removed) and is
    /// stored under a new random id in the upload's own folder. The old file is queued for removal in the same save. It takes no
    /// version; the answer carries the new one. An item that came from an order answers 404: its photos come from the order. A retry
    /// with the same <c>Idempotency-Key</c> and body answers with the stored answer. The change is recorded in the audit log as a photo
    /// change, never with the address, and the public pages show it at once.
    /// </summary>
    /// <param name="id">The gallery entry id.</param>
    /// <param name="file">The photo.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the saved item, 400 when there is no file or it is not a photo we can use, 401 without a valid token, 403 for an Admin, 404 when the upload does not exist or is an order item, 409 when two saves lost a race twice, 413 when the body is too large, 429 when the caller must slow down, or 503 when photo storage is not set up.</returns>
    [HttpPost("{id:guid}/photo")]
    [EndpointName("ReplaceGalleryPhoto")]
    [EnableRateLimiting(RateLimitPolicies.ImageUpload)]
    [UploadSlot]
    [RequestSizeLimitMetadata(ImageUploadLimits.BodyBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = ImageUploadLimits.BodyBytes, MemoryBufferThreshold = ImageUploadLimits.BodyBytes + 1)]
    [ProducesResponseType<GalleryItemRowDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IResult> ReplaceGalleryPhoto(Guid id, IFormFile? file, CancellationToken cancellationToken)
    {
        // The form limits above keep the whole body in memory, so this copy is bounded and never touches the disk.
        using var buffer = new MemoryStream((int)Math.Min(file?.Length ?? 0, ImageUploadLimits.BodyBytes));
        if (file is not null)
        {
            await file.CopyToAsync(buffer, cancellationToken).ConfigureAwait(false);
        }

        var result = await replacePhoto.HandleAsync(id, buffer.GetBuffer().AsMemory(0, (int)buffer.Length), file?.FileName, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static item => TypedResults.Ok(item));
    }

    /// <summary>
    /// Moves an item, an order or an upload, one place up or down in the one gallery order. It swaps with the next item of the list;
    /// send <c>lineId</c> when the list is filtered to a line, and the next item of that line is the neighbour. A move across a page edge
    /// swaps with the item on the next or previous page. A move at the end of the list is a 204 that changes and records nothing. It
    /// takes no version, and a retry with the same <c>Idempotency-Key</c> answers with the stored 204. The public gallery shows the new
    /// order at once; Home's Recent work does not follow it.
    /// </summary>
    /// <param name="id">The gallery entry id.</param>
    /// <param name="body">The direction, <c>up</c> or <c>down</c>, and the optional line filter; a null or unreadable body is reported as a field error.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 400 for a direction that is not up or down, 401 without a valid token, 403 for an Admin, 404 when the item is not in the list (or not in the filtered line), or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/move")]
    [EndpointName("MoveGalleryItem")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> MoveGalleryItem(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] MoveGalleryItemRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await move.HandleAsync(id, body ?? MoveGalleryItemRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Hides an upload: it leaves the public site and stays in this list, and nothing is lost. Hiding a hidden upload is a 204 that
    /// changes and records nothing. It takes no version, and a retry with the same <c>Idempotency-Key</c> answers with the stored 204.
    /// An item that came from an order answers 404: it is taken off the website from its order.
    /// </summary>
    /// <param name="id">The gallery entry id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when it does not exist or is an order item, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/hide")]
    [EndpointName("HideGalleryUpload")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> HideGalleryUpload(Guid id, CancellationToken cancellationToken)
    {
        var result = await setShown.HandleAsync(id, shown: false, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Shows a hidden upload on the public site again (a hidden line still keeps it off). Showing a shown upload is a 204 that changes
    /// and records nothing. It takes no version, and a retry with the same <c>Idempotency-Key</c> answers with the stored 204. An item
    /// that came from an order answers 404.
    /// </summary>
    /// <param name="id">The gallery entry id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when it does not exist or is an order item, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/show")]
    [EndpointName("ShowGalleryUpload")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> ShowGalleryUpload(Guid id, CancellationToken cancellationToken)
    {
        var result = await setShown.HandleAsync(id, shown: true, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Deletes an upload for good. Its photo is queued for removal in the same save and leaves the storage on the next cleanup run;
    /// nothing calls the storage during the request. It takes no version. Deleting an upload that is already gone is a 404, and so is an
    /// item that came from an order: it is taken off the website from its order.
    /// </summary>
    /// <param name="id">The gallery entry id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when it does not exist or is an order item, or 409 when two saves lost a race.</returns>
    [HttpDelete("{id:guid}")]
    [EndpointName("DeleteGalleryUpload")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> DeleteGalleryUpload(Guid id, CancellationToken cancellationToken)
    {
        var result = await delete.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    // Reads the text parts of the form. A line that is not an id is the same as none, so the validator asks for the line. Pieces that are
    // not a number read as 0, so the validator refuses them with the pieces message instead of dropping them silently.
    private static GalleryUploadRequest ReadForm(string? teamName, string? productLineId, string? pieces, string? note, string? isShown, string? version)
    {
        Guid? line = Guid.TryParseExact(productLineId?.Trim(), "D", out var id) ? id : null;
        decimal? count = null;
        if (!string.IsNullOrWhiteSpace(pieces))
        {
            count = decimal.TryParse(pieces.Trim(), NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0m;
        }

        bool? shown = bool.TryParse(isShown?.Trim(), out var flag) ? flag : null;
        return new GalleryUploadRequest(teamName, line, count, note, shown, version);
    }
}
