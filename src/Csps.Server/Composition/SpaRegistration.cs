using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.Composition;

/// <summary>
/// Services the SPA host needs (WEB-01, PERF-02): response compression for the app's static text, so Lighthouse sees
/// small transfers on the shared host (research Pitfall 3).
/// </summary>
public static class SpaRegistration
{
    /// <summary>
    /// Registers Brotli and gzip response compression, over HTTPS too, for <see cref="SpaCaching.CompressibleTypes"/>
    /// only. Setting the MIME list replaces the framework defaults, which include JSON: JSON and ProblemDetails can
    /// carry secrets next to attacker-chosen text, so they are never compressed (BREACH, research Pitfall 3).
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsSpaHosting(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddResponseCompression(static options =>
        {
            options.EnableForHttps = true;
            options.Providers.Add<BrotliCompressionProvider>();
            options.Providers.Add<GzipCompressionProvider>();
            options.MimeTypes = SpaCaching.CompressibleTypes;
        });

        return services;
    }
}

/// <summary>Compression and browser-cache rules for the SPA's static files (PERF-02, T-02-09, T-02-10).</summary>
public static class SpaCaching
{
    /// <summary>The cache header for content-hashed files under <c>/assets</c>: a year, never revalidated.</summary>
    public const string ImmutableCacheControl = "public, max-age=31536000, immutable";

    /// <summary>The cache header for every other static file: the browser revalidates on each use.</summary>
    public const string RevalidateCacheControl = "no-cache";

    /// <summary>The only response types that are compressed: static html, css, JavaScript and SVG. Never JSON.</summary>
    public static IReadOnlyList<string> CompressibleTypes { get; } =
        ["text/html", "text/css", "text/javascript", "application/javascript", "image/svg+xml"];

    /// <summary>
    /// Sets <c>Cache-Control</c> on a static file: immutable for <c>/assets/*</c>, whose names Vite content-hashes,
    /// and <c>no-cache</c> for everything else (<c>index.html</c>, <c>robots.txt</c>, <c>mark.svg</c>), so a new
    /// deploy is picked up at once.
    /// </summary>
    /// <param name="context">The static file response being prepared.</param>
    public static void Apply(StaticFileResponseContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var isHashedAsset = context.Context.Request.Path.StartsWithSegments("/assets", StringComparison.OrdinalIgnoreCase);
        context.Context.Response.Headers[HeaderNames.CacheControl] =
            isHashedAsset ? ImmutableCacheControl : RevalidateCacheControl;
    }
}
