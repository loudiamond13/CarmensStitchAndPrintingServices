using System.Security;
using System.Text;
using Csps.Infrastructure.Email;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.Endpoints;

/// <summary>
/// <c>/robots.txt</c> and <c>/sitemap.xml</c> (PUB-04). Both are built from <c>App:PublicBaseUrl</c> and the page list in
/// <see cref="PublicRouteTable"/>, never from the request's Host header (CWE-644). They are anonymous, left out of
/// OpenAPI and have no rate limit, so a crawler is never refused (research P-10).
/// </summary>
public static class SeoEndpoints
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

        Map(app, RobotsPath, "text/plain; charset=utf-8", Robots);
        Map(app, SitemapPath, "application/xml; charset=utf-8", Sitemap);
        return app;
    }

    private static void Map(WebApplication app, string path, string contentType, Func<string, string> build) =>
        app.MapMethods(path, [HttpMethods.Get, HttpMethods.Head], (HttpContext context) =>
            {
                var origin = context.RequestServices.GetRequiredService<IOptions<AppLinksOptions>>().Value.PublicBaseUrl.TrimEnd('/');
                var response = context.Response;
                response.ContentType = contentType;
                response.Headers[HeaderNames.CacheControl] = "no-cache";
                return HttpMethods.IsHead(context.Request.Method)
                    ? Task.CompletedTask
                    : response.WriteAsync(build(origin), Encoding.UTF8, context.RequestAborted);
            })
            .AllowAnonymous()
            .ExcludeFromDescription();

    private static string Robots(string origin) =>
        $"User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nSitemap: {origin}/sitemap.xml\n";

    private static string Sitemap(string origin)
    {
        var xml = new StringBuilder()
            .Append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
            .Append("<urlset xmlns=\"").Append(SitemapNamespace).Append("\">\n");
        foreach (var pagePath in PublicRouteTable.PagePaths)
        {
            xml.Append("  <url><loc>").Append(SecurityElement.Escape(origin + pagePath)).Append("</loc></url>\n");
        }

        return xml.Append("</urlset>\n").ToString();
    }
}
