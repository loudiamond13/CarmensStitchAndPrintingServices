using Microsoft.AspNetCore.Http.Features;

namespace Csps.Server.Http;

/// <summary>
/// Refuses request bodies above 1 MB before routing (SEC-03, T-04-18). A declared Content-Length over the limit gets a
/// 413 ProblemDetails; any other body is capped through the server's max-body feature, which covers chunked bodies on
/// Kestrel and IIS in-process.
/// </summary>
/// <param name="next">The next middleware.</param>
public sealed class RequestBodyLimitMiddleware(RequestDelegate next)
{
    /// <summary>The largest accepted request body: 1 MiB, the same value as Kestrel, IIS and web.config.</summary>
    public const long MaxBytes = 1_048_576;

    /// <summary>Rejects an oversized declared body, or caps the body size, then calls the next middleware.</summary>
    /// <param name="context">The current HTTP context.</param>
    /// <returns>A task that completes when the rest of the pipeline has run.</returns>
    public Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (context.Request.ContentLength > MaxBytes)
        {
            return CspsProblemDetails.WriteAsync(context, StatusCodes.Status413PayloadTooLarge);
        }

        var feature = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (feature is { IsReadOnly: false })
        {
            feature.MaxRequestBodySize = MaxBytes;
        }

        return next(context);
    }
}
