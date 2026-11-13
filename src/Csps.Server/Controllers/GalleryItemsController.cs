using System.Globalization;
using Csps.Application.Content;
using Csps.Application.Images;
using Csps.Application.Security;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
[ApiController]
[Route("api/v1/gallery-items")]
[Authorize(Policy = Policies.Manager)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class GalleryItemsController(ListGalleryItemsHandler list, CreateGalleryUploadHandler create) : ControllerBase
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
