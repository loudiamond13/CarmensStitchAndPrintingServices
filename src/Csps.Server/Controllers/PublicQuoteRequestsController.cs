using Csps.Application.Images;
using Csps.Application.QuoteRequests;
using Csps.Application.Security;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.RateLimiting;

namespace Csps.Server.Controllers;

/// <summary>
/// The public "Get a Quote" form (INQ-01, INQ-02): anonymous visitors send a quote request and then its photos, one call each. Never
/// cached. A visitor has no account, so the saved request and its photos have no creator (SEC-08).
/// </summary>
/// <param name="create">The create-a-request handler.</param>
/// <param name="uploadPhoto">The upload-a-photo handler.</param>
/// <param name="getTicket">The form ticket handler.</param>
[ApiController]
[Route("api/v1/public/quote-requests")]
[AllowAnonymous]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class PublicQuoteRequestsController(
    CreateQuoteRequestHandler create,
    UploadQuotePhotoHandler uploadPhoto,
    GetQuoteFormTicketHandler getTicket) : ControllerBase
{
    /// <summary>The header that carries the visitor's upload key.</summary>
    public const string UploadKeyHeader = "X-Upload-Key";

    /// <summary>
    /// Gives the quote form its ticket when the form opens (INQ-03). The ticket is signed by the server and holds the time it was
    /// issued, so the server can tell how fast the form was sent; the create call must carry it in <c>ticket</c>. The answer also
    /// lists the photo rules the form checks before it sends a file. A ticket is good for 24 hours by default; the form asks for a new
    /// one when the create call answers 400 with the code <c>quote-requests.ticket-expired</c>. Never cached.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the ticket and the photo rules, or 429 when the address asks too often.</returns>
    [HttpGet("ticket")]
    [EndpointName("GetQuoteFormTicket")]
    [EnableRateLimiting(RateLimitPolicies.PublicRead)]
    [ProducesResponseType<QuoteFormTicketResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IResult> GetTicket(CancellationToken cancellationToken)
    {
        var result = await getTicket.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static response => TypedResults.Ok(response));
    }

    /// <summary>
    /// Saves a quote request. The name and a Philippine mobile number are required; every other field is optional. The request is
    /// saved at status New. Who made it, when, its status and any order link come from the server, so any such member in the body
    /// is ignored. The body must carry the <c>ticket</c> from the ticket call; without a good one the answer is a 400 with the code
    /// <c>quote-requests.ticket-expired</c> and nothing is saved. The member <c>subjectLine</c> is reserved and must be left empty. A visitor who will send photos names up to 5 files in <c>photos</c> and sends an <c>uploadKey</c> the browser made
    /// (32 random bytes as base64url text); the server keeps only the key's SHA-256 and the answer lists one <c>photoSlots</c> entry per
    /// file and never echoes the key. A retry with the same <c>Idempotency-Key</c> and body answers with the stored 200 and saves
    /// nothing more.
    /// </summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the id of the new request and its photo slots, 400 for field errors, or 429 when the address sends too many.</returns>
    [HttpPost]
    [EndpointName("CreateQuoteRequest")]
    [ProducesResponseType<CreateQuoteRequestResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IResult> Create(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] CreateQuoteRequestRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await create.HandleAsync(body ?? CreateQuoteRequestRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static response => TypedResults.Ok(response));
    }

    /// <summary>
    /// Sends one photo to a place the request declared, as a multipart form with the file in the <c>file</c> part. The header
    /// <c>X-Upload-Key</c> must carry the key sent when the request was saved. The type is read from the first bytes of the file
    /// (JPG, PNG, WEBP or HEIC), never from its name or content type; the photo's location and camera data is removed and the file
    /// is kept as sent otherwise, in private storage under the quotes folder. A wrong key, a wrong id, an expired key, a place that
    /// is outside the declared ones or already filled, and a request marked Spam all answer the same 404, so nothing tells which part
    /// was wrong. When photo storage fails the request stays saved and the place stays empty. A retry with the same
    /// <c>Idempotency-Key</c> and body answers with the stored answer and stores nothing more.
    /// </summary>
    /// <param name="id">The quote request id from the create answer.</param>
    /// <param name="slot">The place from the create answer, from 0 to 4.</param>
    /// <param name="file">The photo.</param>
    /// <param name="uploadKey">The upload key, in the <c>X-Upload-Key</c> header.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with no body when the photo is stored, 400 when there is no file, 404 for every miss of the id, key, expiry, status or place, 413 when the file is over 10 MB, 422 when the file is not a photo we can take or has more than 25 megapixels, 429 when the caller must slow down, or 503 when photo storage is not set up or did not take the file.</returns>
    [HttpPost("{id:guid}/photos/{slot:int}")]
    [EndpointName("UploadQuotePhoto")]
    [EnableRateLimiting(RateLimitPolicies.ImageUpload)]
    [UploadSlot]
    [RequestSizeLimitMetadata(ImageUploadLimits.BodyBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = ImageUploadLimits.BodyBytes, MemoryBufferThreshold = ImageUploadLimits.BodyBytes + 1)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IResult> UploadPhoto(
        Guid id,
        int slot,
        IFormFile? file,
        [FromHeader(Name = UploadKeyHeader)] string? uploadKey,
        CancellationToken cancellationToken)
    {
        // The body limit leaves room for the form, so a file one byte over 10 MB still reaches here: refuse it before it is copied.
        if (file is { Length: > ImageUploadLimits.MaxFileBytes })
        {
            return TypedResults.Problem(CspsProblemDetails.Build(HttpContext, StatusCodes.Status413PayloadTooLarge, QuoteRequestErrors.PhotoTooLargeMessage(file.FileName)));
        }

        // The form limits above keep the whole body in memory, so this copy is bounded and never touches the disk.
        using var buffer = new MemoryStream((int)Math.Min(file?.Length ?? 0, ImageUploadLimits.BodyBytes));
        if (file is not null)
        {
            await file.CopyToAsync(buffer, cancellationToken).ConfigureAwait(false);
        }

        var request = new UploadQuotePhotoRequest(buffer.GetBuffer().AsMemory(0, (int)buffer.Length), file?.FileName, uploadKey);
        var result = await uploadPhoto.HandleAsync(id, slot, request, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.Ok());
    }
}
