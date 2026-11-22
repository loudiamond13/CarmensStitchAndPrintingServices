using System.Globalization;
using System.Security;
using System.Text;
using Csps.Application.Ports;
using Csps.Domain.Content;
using Csps.Infrastructure.Email;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.Endpoints;

/// <summary>
/// <c>/robots.txt</c> and <c>/sitemap.xml</c> (PUB-04). Both are built from <c>App:PublicBaseUrl</c> and the page list in
/// <see cref="PublicRouteTable"/>, never from the request's Host header (CWE-644). They are anonymous, left out of
/// OpenAPI and have no rate limit, so a crawler is never refused (research P-10). Each sitemap address carries
/// <c>lastmod</c>, the date of the newest content change, and a legal page the later of that and its own text date; when the
/// content cannot be read the dates are left out.
/// <c>/.well-known/gpc.json</c> (D-39) is mapped the same way and states that the site honors the Global Privacy Control signal.
/// </summary>
public static partial class SeoEndpoints
{
    /// <summary>The robots route.</summary>
    public const string RobotsPath = "/robots.txt";

    /// <summary>The sitemap route.</summary>
    public const string SitemapPath = "/sitemap.xml";

    /// <summary>The Global Privacy Control statement route (D-39).</summary>
    public const string GpcPath = "/.well-known/gpc.json";

    private const string SitemapNamespace = "http://www.sitemaps.org/schemas/sitemap/0.9";

    // The site tracks no one, so it honors the GPC signal by default (D-60, D-20, D-39). The date moves only when that promise changes.
    private const string GpcStatement = "{\"gpc\":true,\"lastUpdate\":\"2026-11-15\"}";

    /// <summary>Maps GET and HEAD for <see cref="RobotsPath"/>, <see cref="SitemapPath"/> and <see cref="GpcPath"/>.</summary>
    /// <param name="app">The web application.</param>
    /// <returns>The same application.</returns>
    public static WebApplication MapSeoEndpoints(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);

        Map(app, RobotsPath, "text/plain; charset=utf-8", (_, origin) => Task.FromResult(Robots(origin)));
        Map(app, SitemapPath, "application/xml; charset=utf-8", SitemapAsync);
        Map(app, GpcPath, "application/json; charset=utf-8", (_, _) => Task.FromResult(GpcStatement));
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
        var legalPages = context.RequestServices.GetRequiredService<ILegalPageCatalog>();
        var lastModified = await LastModifiedAsync(context).ConfigureAwait(false);
        var xml = new StringBuilder()
            .Append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
            .Append("<urlset xmlns=\"").Append(SitemapNamespace).Append("\">\n");
        foreach (var pagePath in PublicRouteTable.PagePaths)
        {
            if (legalPages.IsDraft(pagePath))
            {
                continue;
            }

            xml.Append("  <url><loc>").Append(SecurityElement.Escape(origin + pagePath)).Append("</loc>");
            if (lastModified is { } contentDate)
            {
                var date = LegalPages.ByPath(pagePath) is { } legal && legal.LastUpdated > contentDate ? legal.LastUpdated : contentDate;
                xml.Append("<lastmod>").Append(date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)).Append("</lastmod>");
            }

            xml.Append("</url>\n");
        }

        return xml.Append("</urlset>\n").ToString();
    }

    // The date of the newest content change, or null when the content cannot be read: a sitemap without dates is still a sitemap.
    private static async Task<DateOnly?> LastModifiedAsync(HttpContext context)
    {
        try
        {
            var snapshot = await context.RequestServices.GetRequiredService<IPublicContentReader>()
                .GetSiteAsync(context.RequestAborted).ConfigureAwait(false);
            return DateOnly.FromDateTime(snapshot.Json.LastChangedUtc.UtcDateTime);
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
