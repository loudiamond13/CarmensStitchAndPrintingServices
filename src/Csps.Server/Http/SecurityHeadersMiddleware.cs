using Microsoft.Net.Http.Headers;

namespace Csps.Server.Http;

/// <summary>
/// Sets the SEC-01 security headers on every response (PRD section 11.3). Registered outermost, it sets them in
/// <see cref="HttpResponse.OnStarting(Func{object, Task}, object)"/>, so they survive the exception handler
/// clearing the response. Each header is set with the indexer, never appended, so it appears exactly once.
/// </summary>
/// <param name="next">The next middleware.</param>
public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    /// <summary>The strict Content-Security-Policy, PRD section 11.3 verbatim. No unsafe-inline, no unsafe-eval.</summary>
    public const string StrictCsp =
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests";

    /// <summary>Denies powerful features. Only features browsers recognize, so no console errors (Pitfall 10).</summary>
    public const string PermissionsPolicy =
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";

    /// <summary>HSTS value, sent on HTTPS responses only.</summary>
    public const string StrictTransportSecurity = "max-age=31536000; includeSubDomains";

    /// <summary>Registers the header callback and calls the next middleware.</summary>
    /// <param name="context">The current HTTP context.</param>
    /// <returns>A task that completes when the rest of the pipeline has run.</returns>
    public Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        context.Response.OnStarting(static state =>
        {
            SetHeaders((HttpContext)state);
            return Task.CompletedTask;
        }, context);

        return next(context);
    }

    private static void SetHeaders(HttpContext context)
    {
        var headers = context.Response.Headers;
        headers.ContentSecurityPolicy = StrictCsp;
        headers.XContentTypeOptions = "nosniff";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = PermissionsPolicy;
        headers["Cross-Origin-Opener-Policy"] = "same-origin";
        if (context.Request.IsHttps)
        {
            headers.StrictTransportSecurity = StrictTransportSecurity;
        }

        headers.Remove(HeaderNames.Server);
        headers.Remove(HeaderNames.XPoweredBy);
    }
}
