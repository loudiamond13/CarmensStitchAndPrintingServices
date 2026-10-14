using Microsoft.Net.Http.Headers;
using Scalar.AspNetCore;

namespace Csps.Server.Http;

/// <summary>
/// Sets the SEC-01 security headers on every response (PRD section 11.3). Registered outermost, it sets them in
/// <see cref="HttpResponse.OnStarting(Func{object, Task}, object)"/>, so they survive the exception handler
/// clearing the response. Each header is set with the indexer, never appended, so it appears exactly once.
/// </summary>
/// <param name="next">The next middleware.</param>
/// <param name="environment">The host environment; the Scalar carve-out exists in Development only.</param>
public sealed class SecurityHeadersMiddleware(RequestDelegate next, IHostEnvironment environment)
{
    /// <summary>The strict Content-Security-Policy, PRD section 11.3 verbatim. No unsafe-inline, no unsafe-eval.</summary>
    public const string StrictCsp =
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests";

    /// <summary>Denies powerful features. Only features browsers recognize, so no console errors (Pitfall 10).</summary>
    public const string PermissionsPolicy =
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";

    /// <summary>HSTS value, sent on HTTPS responses only.</summary>
    public const string StrictTransportSecurity = "max-age=31536000; includeSubDomains";

    /// <summary>The path of the Development-only Scalar viewer (D-14).</summary>
    public const string ScalarPath = "/scalar";

    private readonly bool _isDevelopment = environment.IsDevelopment();

    /// <summary>Registers the header callback and calls the next middleware.</summary>
    /// <param name="context">The current HTTP context.</param>
    /// <returns>A task that completes when the rest of the pipeline has run.</returns>
    public Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var isDevScalar = _isDevelopment && context.Request.Path.StartsWithSegments(ScalarPath, StringComparison.OrdinalIgnoreCase);
        context.Response.OnStarting(
            isDevScalar ? static state => SetHeaders((HttpContext)state, devScalar: true) : static state => SetHeaders((HttpContext)state, devScalar: false),
            context);

        return next(context);
    }

    /// <summary>
    /// The Development-only CSP for <c>/scalar</c>: Scalar's inline scripts run only with this request's nonce.
    /// <c>style-src 'unsafe-inline'</c> is there because Scalar injects styles at runtime (assumption A7, to be
    /// confirmed in a browser). It never applies outside Development.
    /// </summary>
    /// <param name="nonce">The per-request nonce Scalar stamped on its scripts, or null when there is none.</param>
    /// <returns>The carve-out policy.</returns>
    public static string ScalarDevelopmentCsp(string? nonce)
    {
        var nonceSource = IsSafeNonce(nonce) ? $" 'nonce-{nonce}'" : string.Empty;
        return $"default-src 'self'; script-src 'self'{nonceSource}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'";
    }

    private static Task SetHeaders(HttpContext context, bool devScalar)
    {
        var headers = context.Response.Headers;
        headers.ContentSecurityPolicy = devScalar
            ? ScalarDevelopmentCsp(context.Items[ScalarOptions.NonceHttpContextItemKey] as string)
            : StrictCsp;
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
        return Task.CompletedTask;
    }

    // A nonce goes into a header value, so only base64/base64url characters are accepted (no quote, ';' or newline).
    private static bool IsSafeNonce(string? nonce) =>
        !string.IsNullOrEmpty(nonce)
        && nonce.All(c => char.IsAsciiLetterOrDigit(c) || c is '+' or '/' or '=' or '-' or '_');
}
