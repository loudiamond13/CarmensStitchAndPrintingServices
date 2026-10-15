using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Configuration.CommandLine;
using Microsoft.Extensions.Configuration.EnvironmentVariables;
using Microsoft.Extensions.Configuration.Json;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Testing;

/// <summary>
/// D-37, Pitfall 10: a developer's user-secrets reach the Testing environment only when the Playwright host asks
/// for them with <c>Csps:Testing:LoadUserSecrets</c>, and environment variables and the command line still win.
/// </summary>
public sealed class TestingConfigurationTests
{
    private const string SwitchKey = "Csps:Testing:LoadUserSecrets";

    [Fact]
    public async Task TestHostsDoNotReadUserSecrets()
    {
        await using var factory = new CspsApiFactory();

        UserSecretsIndex(Providers(factory)).ShouldBe(-1);
    }

    [Fact]
    public async Task TheSwitchAddsUserSecretsBeforeEnvironmentVariablesAndTheCommandLine()
    {
        await using var baseFactory = new CspsApiFactory();
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseSetting(SwitchKey, "true"));

        var providers = Providers(factory);
        var secrets = UserSecretsIndex(providers);
        var lastEnvironment = providers.FindLastIndex(static provider => provider is EnvironmentVariablesConfigurationProvider);

        secrets.ShouldBeGreaterThanOrEqualTo(0);
        lastEnvironment.ShouldBeGreaterThan(secrets);
        providers.FindLastIndex(static provider => provider is CommandLineConfigurationProvider).ShouldBeGreaterThan(lastEnvironment);
    }

    [Fact]
    public async Task OtherEnvironmentsIgnoreTheSwitch()
    {
        await using var baseFactory = new CspsApiFactory();
        await using var factory = baseFactory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Staging");
            builder.UseSetting(SwitchKey, "true");
        });

        UserSecretsIndex(Providers(factory)).ShouldBe(-1);
    }

#if DEBUG
    [Fact]
    public void EnvironmentVariablesAndTheCommandLineStillOverrideUserSecrets()
    {
        var name = $"CspsTestingConfig{Guid.NewGuid():N}";
        Environment.SetEnvironmentVariable($"{name}__FromEnvironment", "environment");
        try
        {
            var configuration = new ConfigurationManager();
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                [$"{name}:FromEnvironment"] = "appsettings",
                [$"{name}:FromCommandLine"] = "appsettings",
                [$"{name}:FromSecrets"] = "appsettings",
            });
            configuration.AddEnvironmentVariables();

            // The in-memory source stands in for the user-secrets file.
            Csps.Server.Testing.TestingConfiguration.AddUserSecrets(
                configuration,
                [$"--{name}:FromCommandLine=command-line"],
                builder => builder.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    [$"{name}:FromEnvironment"] = "secret",
                    [$"{name}:FromCommandLine"] = "secret",
                    [$"{name}:FromSecrets"] = "secret",
                }));

            configuration[$"{name}:FromEnvironment"].ShouldBe("environment");
            configuration[$"{name}:FromCommandLine"].ShouldBe("command-line");
            configuration[$"{name}:FromSecrets"].ShouldBe("secret");
        }
        finally
        {
            Environment.SetEnvironmentVariable($"{name}__FromEnvironment", null);
        }
    }
#endif

    private static List<IConfigurationProvider> Providers(CspsApiFactory factory)
    {
        using var client = factory.CreateClient();
        return [.. ((IConfigurationRoot)factory.Services.GetRequiredService<IConfiguration>()).Providers];
    }

    // User-secrets are a JSON file source whose path is secrets.json.
    private static int UserSecretsIndex(List<IConfigurationProvider> providers) =>
        providers.FindLastIndex(static provider =>
            provider is JsonConfigurationProvider json && string.Equals(json.Source.Path, "secrets.json", StringComparison.Ordinal));
}
