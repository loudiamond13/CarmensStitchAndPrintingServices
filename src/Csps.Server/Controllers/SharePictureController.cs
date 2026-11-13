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
/// The default link preview picture of the website (D-26): a Manager sets it and takes it away. Shared links to Home, Contact and any
/// page without a picture of its own show it. Files reach the image storage through the server only, never straight from the browser,
/// and are held in memory, never on disk. Never cached.
/// </summary>
/// <param name="upload">The upload handler.</param>
[ApiController]
[Route("api/v1/site-settings/share-picture")]
[Authorize(Policy = Policies.Manager)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class SharePictureController(UploadSharePictureHandler upload) : ControllerBase
{
    /// <summary>
    /// Sets the default link preview picture as a multipart form with the file in the <c>file</c> part. The type is read from the first
    /// bytes of the file (JPG, PNG, WEBP or HEIC), never from its name or content type, and a file that is not a photo we can use, is over
    /// 10 MB or has too many pixels answers 400 and is never sent to storage. Location and camera data are removed. The picture is stored
    /// under a new random id every time, so a link shared before the change is not stuck with the old picture, and the file it replaces is
    /// queued for removal in the same save. When photo storage is not set up the answer is 503 <c>images.not-configured</c>. A retry with
    /// the same <c>Idempotency-Key</c> and body answers with the stored answer and adds nothing more. The public pages carry the new
    /// picture at once.
    /// </summary>
    /// <param name="file">The picture.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the two preview addresses, 400 when there is no file or the file is not a photo we can use, 401 without a valid token, 403 for an Admin, 409 when two saves lost a race twice, 413 when the body is too large, 429 when the caller must slow down, or 503 when photo storage is not set up.</returns>
    [HttpPost]
    [EndpointName("UploadSharePicture")]
    [EnableRateLimiting(RateLimitPolicies.ImageUpload)]
    [RequestSizeLimitMetadata(ImageUploadLimits.BodyBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = ImageUploadLimits.BodyBytes, MemoryBufferThreshold = ImageUploadLimits.BodyBytes + 1)]
    [ProducesResponseType<SharePictureDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IResult> UploadSharePicture(IFormFile? file, CancellationToken cancellationToken)
    {
        // The form limits above keep the whole body in memory, so this copy is bounded and never touches the disk.
        using var buffer = new MemoryStream((int)Math.Min(file?.Length ?? 0, ImageUploadLimits.BodyBytes));
        if (file is not null)
        {
            await file.CopyToAsync(buffer, cancellationToken).ConfigureAwait(false);
        }

        var request = new UploadSharePictureRequest(buffer.GetBuffer().AsMemory(0, (int)buffer.Length), file?.FileName);
        var result = await upload.HandleAsync(request, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static picture => TypedResults.Ok(picture));
    }
}
