using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Csps.Testing;

/// <summary>Hosts the real API pipeline in memory for integration tests, in the <c>Testing</c> environment.</summary>
public class CspsApiFactory : WebApplicationFactory<Program>
{
    /// <summary>The environment name every integration test runs under.</summary>
    public const string EnvironmentName = "Testing";

    /// <summary>Creates the factory with an https://localhost base address.</summary>
    public CspsApiFactory()
    {
        ClientOptions.BaseAddress = new Uri("https://localhost");
    }

    /// <inheritdoc />
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.UseEnvironment(EnvironmentName);
        ConfigureSettings(builder);
    }

    /// <summary>
    /// Hook for derived factories to inject configuration with <c>builder.UseSetting(key, value)</c>,
    /// which Program's top-level code can read before <c>Build()</c>.
    /// </summary>
    protected virtual void ConfigureSettings(IWebHostBuilder builder)
    {
    }
}
