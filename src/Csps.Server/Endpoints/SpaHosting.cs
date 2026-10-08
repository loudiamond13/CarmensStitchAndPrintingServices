namespace Csps.Server.Endpoints;

/// <summary>
/// Serves the React single-page app from the web root (WEB-01). Placeholder for the TDD red step: it maps nothing yet.
/// </summary>
public static class SpaHosting
{
    /// <summary>Maps the SPA host. Not implemented yet.</summary>
    /// <param name="app">The web application.</param>
    /// <returns>The same application.</returns>
    public static WebApplication MapSpaHost(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);
        return app;
    }
}
