#if CSPS_TESTING
using System.Text.Json;
using Csps.Application.Images;
using Csps.Infrastructure.Images;
using Csps.Server.Http;
using Csps.Server.Security;
using Csps.Server.Testing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// Lets tests and Playwright load the photos the fake store holds and make the next uploads fail, so no end-to-end run ever calls
/// Cloudinary (IMG-01, D-07, QUAL-05). It exists in the Testing environment of a Debug build only.
/// </summary>
/// <param name="storage">The in-memory photo store.</param>
[TestingOnly]
[ApiController]
[Route("api/testing/images")]
[AllowAnonymous]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class TestingImagesController(TestingImageStorage storage) : ControllerBase
{
    private const int MostFailures = 50;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>The body of the fail-next call.</summary>
    /// <param name="Count">How many of the next uploads to fail; 0 clears the switch.</param>
    public sealed record FailNextRequest(int? Count = null);

    /// <summary>Returns the bytes of a stored photo. The <c>size</c> query is accepted and ignored: every size is the original file.</summary>
    /// <param name="id">The last segment of the photo's public id.</param>
    /// <returns>200 with the file and its stored content type, or 404 when no photo is stored under that id.</returns>
    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult Get(string id) =>
        storage.TryGet(id, out var image) ? File(image.Bytes.ToArray(), ContentType(image.Kind)) : NotFound();

    /// <summary>Makes the next uploads fail as if the store were down.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204 when armed, or 400 when the count is missing or not from 0 to 50.</returns>
    [HttpPost("fail-next")]
    [IdempotencyExempt("Testing-only test switch, compiled out of Release.")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IResult> FailNext(CancellationToken cancellationToken)
    {
        // Read here, not bound, so a missing or malformed body is the same plain 400 for every caller.
        FailNextRequest? request;
        try
        {
            request = await JsonSerializer.DeserializeAsync<FailNextRequest>(Request.Body, JsonOptions, cancellationToken).ConfigureAwait(false);
        }
        catch (JsonException)
        {
            request = null;
        }

        if (request?.Count is null or < 0 or > MostFailures)
        {
            var errors = new Dictionary<string, string[]>(StringComparer.Ordinal) { ["count"] = [$"Send a count from 0 to {MostFailures}."] };
            return TypedResults.Problem(CspsProblemDetails.Build(HttpContext, StatusCodes.Status400BadRequest, errors["count"][0], errors));
        }

        storage.FailNext(request.Count.Value);
        return TypedResults.NoContent();
    }

    private static string ContentType(ImageKind kind) => kind switch
    {
        ImageKind.Jpeg => "image/jpeg",
        ImageKind.Png => "image/png",
        ImageKind.WebP => "image/webp",
        ImageKind.Heic => "image/heic",
        _ => "application/octet-stream",
    };
}
#endif
