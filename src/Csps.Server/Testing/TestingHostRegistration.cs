#if CSPS_TESTING
namespace Csps.Server.Testing;

/// <summary>Wires the Testing-only features into the host (QUAL-05, D-37). Debug builds only.</summary>
public static class TestingHostRegistration
{
    /// <summary>The setting that lets an in-process test host run a Debug build as Production. Only the test factory sets it.</summary>
    public const string AllowProductionKey = "Csps:Testing:AllowProductionEnvironment";

    /// <summary>
    /// Keeps the Testing-only controllers in the Testing environment and removes them everywhere else. A Debug build
    /// refuses to start as Production.
    /// </summary>
    /// <param name="mvc">The MVC builder.</param>
    /// <param name="builder">The web application builder.</param>
    /// <returns>The same MVC builder.</returns>
    /// <exception cref="InvalidOperationException">The Debug build was started as Production.</exception>
    public static IMvcBuilder AddTestingFeatures(this IMvcBuilder mvc, WebApplicationBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(mvc);
        ArgumentNullException.ThrowIfNull(builder);

        if (builder.Environment.IsProduction() && !builder.Configuration.GetValue<bool>(AllowProductionKey))
        {
            throw new InvalidOperationException("A Debug build with Testing features must never run in Production (D-37).");
        }

        var isTesting = builder.Environment.IsEnvironment("Testing");
        return mvc.ConfigureApplicationPartManager(manager => manager.FeatureProviders.Add(new TestingControllersFeatureProvider(isTesting)));
    }
}
#endif
