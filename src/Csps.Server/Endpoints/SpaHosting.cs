using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.Endpoints;

/// <summary>
/// Serves the React single-page app from the web root (WEB-01). Every non-file path that matches no other endpoint
/// gets the shell <c>index.html</c>, anonymously, so the browser router can draw the page. Unknown <c>/api</c> paths
/// never reach it: the literal <see cref="ApiRouting.FallbackPattern"/> outranks the catch-all (FND-05).
/// </summary>
/// <remarks>
/// Real files never reach the fallbacks: <c>Program.cs</c> runs <c>UseStaticFiles()</c> before an explicit
/// <c>UseRouting()</c>, so a file that exists is served before any endpoint is matched.
/// </remarks>
public static class SpaHosting
{
    /// <summary>The shell file in the web root that every client-side route loads.</summary>
    public const string ShellFile = "index.html";

    /// <summary>
    /// The route pattern <c>MapFallbackToFile</c> registers: any path whose last segment has no dot. It is the key the
    /// authorization matrix uses for the shell endpoint, once for GET and once for HEAD.
    /// </summary>
    public const string ShellPattern = "{*path:nonfile}";

    /// <summary>
    /// Maps the anonymous shell fallback. <c>MapFallbackToFile</c> registers GET and HEAD only, so any other method on
    /// a page path still meets the default-deny fallback policy. The shell is sent with <c>Cache-Control: no-cache</c>,
    /// so a browser always revalidates it and picks up a new deploy's hashed assets.
    /// </summary>
    /// <param name="app">The web application.</param>
    /// <returns>The same application.</returns>
    public static WebApplication MapSpaHost(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);

        app.MapFallbackToFile(ShellFile, new StaticFileOptions { OnPrepareResponse = static context => NoCache(context) })
            .AllowAnonymous();

        return app;
    }

    private static void NoCache(StaticFileResponseContext context) =>
        context.Context.Response.Headers[HeaderNames.CacheControl] = "no-cache";
}
