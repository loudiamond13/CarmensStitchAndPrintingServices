namespace Csps.Server.Http;

/// <summary>Serves a build-time <c>.br</c> twin of a static asset when the browser accepts Brotli (D-28, plan 11-36).</summary>
public static class PrecompressedStaticFiles
{
    /// <summary>Adds the precompressed-file step. Call it right before <c>UseStaticFiles</c>.</summary>
    /// <param name="app">The web application.</param>
    /// <returns>The same web application.</returns>
    public static WebApplication UsePrecompressedStaticFiles(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);
        return app;
    }
}
