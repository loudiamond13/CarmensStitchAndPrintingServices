using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.Endpoints;

/// <summary>
/// Serves the React single-page app from the web root (WEB-01). Every non-file path that matches no other endpoint
/// gets the shell <c>index.html</c>, anonymously, so the browser router can draw the page. Unknown <c>/api</c> paths
/// never reach it: the literal <see cref="ApiRouting.FallbackPattern"/> outranks the catch-all (FND-05).
/// </summary>
public static class SpaHosting
{
    /// <summary>The shell file in the web root that every client-side route loads.</summary>
    public const string ShellFile = "index.html";

    /// <summary>
    /// The route pattern <c>MapFallbackToFile</c> registers: any path whose last segment has no dot. It is the key the
    /// authorization matrix uses for the shell endpoint.
    /// </summary>
    public const string ShellPattern = "{*path:nonfile}";

    /// <summary>
    /// Maps the anonymous shell fallback. The shell is sent with <c>Cache-Control: no-cache</c>, so a browser always
    /// revalidates it and picks up a new deploy's hashed assets.
    /// </summary>
    /// <param name="endpoints">The endpoint route builder.</param>
    /// <returns>The convention builder for further configuration.</returns>
    public static IEndpointConventionBuilder MapSpaShell(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        return endpoints
            .MapFallbackToFile(ShellFile, new StaticFileOptions { OnPrepareResponse = static context => NoCache(context) })
            .AllowAnonymous();
    }

    private static void NoCache(StaticFileResponseContext context) =>
        context.Context.Response.Headers[HeaderNames.CacheControl] = "no-cache";
}
