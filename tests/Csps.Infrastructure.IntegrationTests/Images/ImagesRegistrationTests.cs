using Csps.Application.Ports;
using Csps.Infrastructure.Images;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.IntegrationTests.Images;

/// <summary>IMG-03, D-07: each host builds its photo addresses its own way and stays in its own Cloudinary folder.</summary>
public sealed class ImagesRegistrationTests
{
    private static ServiceProvider Build(string environmentName, Dictionary<string, string?>? overrides = null)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile($"appsettings.{environmentName}.json", optional: true)
            .AddInMemoryCollection(overrides ?? [])
            .Build();
        var services = new ServiceCollection();
        services.AddSingleton(TimeProvider.System);
        services.AddCspsImages(configuration, new TestEnvironment(environmentName));
        return services.BuildServiceProvider();
    }

    [Fact]
    public void ADevelopmentHostBuildsCloudinaryAddressesFromTheDevelopmentFolder()
    {
        using var provider = Build(Environments.Development);

        provider.GetRequiredService<IStartupValidator>().Validate();
        provider.GetRequiredService<IImageDelivery>().ShouldBeOfType<CloudinaryImageDelivery>();
        provider.GetRequiredService<IOptions<CloudinarySettings>>().Value.RootFolder.ShouldBe("csps-dev");
    }

    [Fact]
    public void AProductionHostUsesTheLiveFolderFromTheBaseSettings()
    {
        using var provider = Build(Environments.Production);

        provider.GetRequiredService<IStartupValidator>().Validate();
        provider.GetRequiredService<IOptions<CloudinarySettings>>().Value.RootFolder.ShouldBe("csps");
    }

    [Fact]
    public void AProductionHostConfiguredWithTheDevelopmentFolderIsRefusedAtStart()
    {
        using var provider = Build(Environments.Production, new() { ["Cloudinary:RootFolder"] = "csps-dev" });

        var failure = Should.Throw<OptionsValidationException>(() => provider.GetRequiredService<IStartupValidator>().Validate());

        failure.Message.ShouldContain("Cloudinary:RootFolder must be csps in Production.");
    }

    [Fact]
    public void ADevelopmentHostConfiguredWithTheLiveFolderIsRefusedAtStart()
    {
        using var provider = Build(Environments.Development, new() { ["Cloudinary:RootFolder"] = "csps" });

        var failure = Should.Throw<OptionsValidationException>(() => provider.GetRequiredService<IStartupValidator>().Validate());

        failure.Message.ShouldContain("is the live folder");
    }

    [Fact]
    public void ATestingHostBuildsSameOriginAddressesAndNeverCloudinaryOnes()
    {
        using var provider = Build("Testing");

        var delivery = provider.GetRequiredService<IImageDelivery>().ShouldBeOfType<TestingImageDelivery>();
        delivery.ForPhoto("csps-test/orders/abc/xyz", 800, 600).Thumb.Src.ShouldBe("/api/testing/images/xyz?size=csps_sq_88");
    }

    [Fact]
    public void NoAppSettingsFileHoldsACloudNameKeyOrSecret()
    {
        foreach (var file in new[] { "appsettings.json", "appsettings.Development.json" })
        {
            var text = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, file));

            text.ShouldNotContain("CloudName", Case.Insensitive, file);
            text.ShouldNotContain("ApiKey", Case.Insensitive, file);
            text.ShouldNotContain("ApiSecret", Case.Insensitive, file);
        }
    }

    private sealed class TestEnvironment(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;

        public string ApplicationName { get; set; } = "Csps.Tests";

        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
