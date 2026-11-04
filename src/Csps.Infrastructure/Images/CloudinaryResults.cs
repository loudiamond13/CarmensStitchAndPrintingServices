using System.Net;
using Csps.Application.Images;
using Csps.Application.Ports;

namespace Csps.Infrastructure.Images;

/// <summary>How Cloudinary answers map to storage outcomes (IMG-01, D-05).</summary>
internal static class CloudinaryResults
{
    /// <summary>The failure code of a busy, rate-limited or unreachable Cloudinary; trying again later can work.</summary>
    public const string TransientCode = "transient";

    /// <summary>The failure code of keys that Cloudinary does not accept; trying again will not help.</summary>
    public const string UnauthorizedCode = "unauthorized";

    /// <summary>The failure code of any other refusal; trying again will not help.</summary>
    public const string RefusedCode = "refused";

    private const int EnhanceYourCalm = 420;

    /// <summary>Maps the answer to an upload.</summary>
    /// <param name="status">The HTTP status Cloudinary answered with.</param>
    /// <returns>Stored for a 2xx answer, otherwise a failure with a short code.</returns>
    public static ImageUploadOutcome ForUpload(HttpStatusCode status) => status switch
    {
        >= HttpStatusCode.OK and < HttpStatusCode.MultipleChoices => ImageUploadOutcome.Stored,
        HttpStatusCode.BadRequest => ImageUploadOutcome.Failed(ImageErrors.TypeCode),
        _ => ImageUploadOutcome.Failed(FailureCode(status)),
    };

    /// <summary>Maps an answer that is not a success to a short failure code.</summary>
    /// <param name="status">The HTTP status.</param>
    /// <returns><c>unauthorized</c>, <c>transient</c> or <c>refused</c>.</returns>
    public static string FailureCode(HttpStatusCode status) => IsTransient(status) ? TransientCode
        : status is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden ? UnauthorizedCode
        : RefusedCode;

    /// <summary>Tells whether a status means "busy, try again later": rate limits (420, 429) and server errors.</summary>
    /// <param name="status">The HTTP status.</param>
    /// <returns>True when a later try can work.</returns>
    public static bool IsTransient(HttpStatusCode status) =>
        (int)status == EnhanceYourCalm || status == HttpStatusCode.TooManyRequests || (int)status >= (int)HttpStatusCode.InternalServerError;
}
