using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Http.Metadata;

namespace Csps.Server.Http;

/// <summary>
/// Refuses request bodies above the matched endpoint's limit (SEC-03, T-04-18, T-09-26). The limit is 1 MiB unless the endpoint
/// carries <c>[RequestSizeLimit]</c> (only the photo upload does). A declared Content-Length over the limit gets a 413 ProblemDetails;
/// any other body is capped through the server's max-body feature, which covers chunked bodies on Kestrel and IIS in-process.
/// It runs right after routing, so the endpoint and its metadata are known.
/// </summary>
/// <param name="next">The next middleware.</param>
public sealed class RequestBodyLimitMiddleware(RequestDelegate next)
{
    /// <summary>The largest accepted request body of an endpoint without its own limit: 1 MiB, the same value as Kestrel, IIS and web.config.</summary>
    public const long MaxBytes = 1_048_576;

    /// <summary>Gets the body limit that applies to the matched endpoint.</summary>
    /// <param name="context">The current HTTP context.</param>
    /// <returns>The endpoint's <c>[RequestSizeLimit]</c> value, or <see cref="MaxBytes"/>.</returns>
    public static long LimitFor(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        return context.GetEndpoint()?.Metadata.GetMetadata<IRequestSizeLimitMetadata>()?.MaxRequestBodySize ?? MaxBytes;
    }

    /// <summary>Rejects an oversized declared body, or caps the body size, then calls the next middleware.</summary>
    /// <param name="context">The current HTTP context.</param>
    /// <returns>A task that completes when the rest of the pipeline has run.</returns>
    public Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var limit = LimitFor(context);
        if (context.Request.ContentLength > limit)
        {
            return CspsProblemDetails.WriteAsync(context, StatusCodes.Status413PayloadTooLarge);
        }

        var feature = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (feature is { IsReadOnly: false })
        {
            feature.MaxRequestBodySize = limit;
        }

        return next(context);
    }
}
