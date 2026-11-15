using System.Globalization;
using System.Security;
using System.Text;
using Csps.Application.Ports;
using Csps.Infrastructure.Email;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.Endpoints;

/// <summary>
/// <c>/robots.txt</c> and <c>/sitemap.xml</c> (PUB-04). Both are built from <c>App:PublicBaseUrl</c> and the page list in
/// <see cref="PublicRouteTable"/>, never from the request's Host header (CWE-644). They are anonymous, left out of
/// OpenAPI and have no rate limit, so a crawler is never refused (research P-10). Each sitemap address carries
/// <c>lastmod</c>, the date of the newest content change; when the content cannot be read the dates are left out.
/// </summary>
public static partial class SeoEndpoints
{
    /// <summary>The robots route.</summary>
    public const string RobotsPath = "/robots.txt";

    /// <summary>The sitemap route.</summary>
    public const string SitemapPath = "/sitemap.xml";

    private const string SitemapNamespace = "http://www.sitemaps.org/schemas/sitemap/0.9";

    /// <summary>Maps GET and HEAD for <see cref="RobotsPath"/> and <see cref="SitemapPath"/>.</summary>
    /// <param name="app">The web application.</param>
    /// <returns>The same application.</returns>
    public static WebApplication MapSeoEndpoints(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);

        Map(app, RobotsPath, "text/plain; charset=utf-8", (_, origin) => Task.FromResult(Robots(origin)));
        Map(app, SitemapPath, "application/xml; charset=utf-8", SitemapAsync);
        return app;
    }

    private static void Map(WebApplication app, string path, string contentType, Func<HttpContext, string, Task<string>> build) =>
        app.MapMethods(path, [HttpMethods.Get, HttpMethods.Head], async (HttpContext context) =>
            {
                var origin = context.RequestServices.GetRequiredService<IOptions<AppLinksOptions>>().Value.PublicBaseUrl.TrimEnd('/');
                var response = context.Response;
                response.ContentType = contentType;
                response.Headers[HeaderNames.CacheControl] = "no-cache";
                if (!HttpMethods.IsHead(context.Request.Method))
                {
                    var body = await build(context, origin).ConfigureAwait(false);
                    await response.WriteAsync(body, Encoding.UTF8, context.RequestAborted).ConfigureAwait(false);
                }
            })
            .AllowAnonymous()
            .ExcludeFromDescription();

    private static string Robots(string origin) =>
        $"User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nSitemap: {origin}/sitemap.xml\n";

    private static async Task<string> SitemapAsync(HttpContext context, string origin)
    {
        var lastModified = await LastModifiedAsync(context).ConfigureAwait(false);
        var xml = new StringBuilder()
            .Append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
            .Append("<urlset xmlns=\"").Append(SitemapNamespace).Append("\">\n");
        foreach (var pagePath in PublicRouteTable.PagePaths)
        {
            xml.Append("  <url><loc>").Append(SecurityElement.Escape(origin + pagePath)).Append("</loc>");
            if (lastModified is not null)
            {
                xml.Append("<lastmod>").Append(lastModified).Append("</lastmod>");
            }

            xml.Append("</url>\n");
        }

        return xml.Append("</urlset>\n").ToString();
    }

    // The date of the newest content change, or null when the content cannot be read: a sitemap without dates is still a sitemap.
    private static async Task<string?> LastModifiedAsync(HttpContext context)
    {
        try
        {
            var snapshot = await context.RequestServices.GetRequiredService<IPublicContentReader>()
                .GetSiteAsync(context.RequestAborted).ConfigureAwait(false);
            return snapshot.Json.LastChangedUtc.UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            LogContentFailed(context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(SeoEndpoints)), exception);
            return null;
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "The public content could not be read, so the sitemap is sent without dates")]
    private static partial void LogContentFailed(ILogger logger, Exception exception);
}
