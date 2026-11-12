using System.Net.Mime;
using Csps.Server.Http;

namespace Csps.Server.Endpoints;

/// <summary>
/// Serves the React single-page app from the web root (WEB-01). Every non-file path that matches no other endpoint
/// gets the shell <c>index.html</c>, anonymously, shaped by <see cref="ShellPage"/> with the page's own head and status
/// (PUB-04), so the browser router can draw the page. Unknown <c>/api</c> paths never reach it: the literal
/// <see cref="ApiRouting.FallbackPattern"/> outranks the catch-all (FND-05).
/// </summary>
/// <remarks>
/// Fallbacks with a literal prefix (<c>/api/{**path}</c>, <c>/openapi/{**path}</c>, <c>/scalar/{**path}</c>) outrank
/// the two catch-all patterns, so <c>/openapi/v1.json</c> reaches its reserved fallback, not the file 404 or the shell.
/// Real files never reach <see cref="FilePattern"/>: <c>Program.cs</c> runs <c>UseStaticFiles()</c> before an explicit
/// <c>UseRouting()</c>, so a file that exists is served before any endpoint is matched.
/// </remarks>
public static class SpaHosting
{
    /// <summary>The shell file in the web root that every client-side route loads.</summary>
    public const string ShellFile = "index.html";

    /// <summary>
    /// The route pattern of the shell endpoint: any path whose last segment has no dot. It is the key the
    /// authorization matrix uses for the shell endpoint, once for GET and once for HEAD.
    /// </summary>
    public const string ShellPattern = "{*path:nonfile}";

    /// <summary>
    /// The catch-all for file-like paths (last segment has a dot) that no static file answered: a missing file is an
    /// anonymous ProblemDetails 404, never the shell and never a 401 from the default-deny policy (research Pitfall 11).
    /// </summary>
    public const string FilePattern = "{*path:file}";

    /// <summary>
    /// The API-doc prefixes that stay reserved for the server outside Development, where nothing else maps them (D-29).
    /// Each gets a ProblemDetails 404 fallback marked with <see cref="ReservedPathMetadata"/>.
    /// </summary>
    public static IReadOnlyList<string> ReservedDocsPatterns { get; } = ["/openapi/{**path}", "/scalar/{**path}"];

    /// <summary>
    /// Maps the whole SPA host, in order: <c>robots.txt</c> and <c>sitemap.xml</c>, the missing-file 404, the reserved
    /// API-doc 404s (outside Development only, D-29), then the shell. All are anonymous. The shell endpoint carries GET
    /// and HEAD metadata only, so any other method on a page path still meets the default-deny fallback policy (L-01).
    /// </summary>
    /// <param name="app">The web application.</param>
    /// <returns>The same application.</returns>
    public static WebApplication MapSpaHost(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);

        app.MapSeoEndpoints();

        app.MapFallback(FilePattern, NotFound).AllowAnonymous().ExcludeFromDescription();

        if (!app.Environment.IsDevelopment())
        {
            foreach (var pattern in ReservedDocsPatterns)
            {
                app.MapFallback(pattern, NotFound)
                    .AllowAnonymous()
                    .ExcludeFromDescription()
                    .WithMetadata(new ReservedPathMetadata());
            }
        }

        // Shaped with the page's own head and status; Cache-Control: no-cache, so a browser always revalidates it and
        // picks up a new deploy's hashed assets. Without the method metadata a fallback matches every method.
        app.MapFallback(ShellPattern, ShellPage.WriteAsync)
            .WithMetadata(new HttpMethodMetadata([HttpMethods.Get, HttpMethods.Head]))
            .AllowAnonymous()
            .ExcludeFromDescription();

        return app;
    }

    /// <summary>
    /// The anonymous ProblemDetails 404. HEAD gets the same status and media type with no content (RFC 9110 section
    /// 9.3.2): Kestrel drops a HEAD body anyway, and writing none keeps every host, the test host included, identical.
    /// </summary>
    private static Task NotFound(HttpContext context)
    {
        if (HttpMethods.IsHead(context.Request.Method))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            context.Response.ContentType = MediaTypeNames.Application.ProblemJson;
            return Task.CompletedTask;
        }

        return CspsProblemDetails.WriteAsync(context, StatusCodes.Status404NotFound);
    }
}
