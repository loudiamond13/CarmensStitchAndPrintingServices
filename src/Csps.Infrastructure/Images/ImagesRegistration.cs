using Csps.Application.Images;
using Csps.Application.Ports;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.Images;

/// <summary>Registers the image storage and the upload limits (IMG-01, IMG-02).</summary>
public static class ImagesRegistration
{
    private const string TestingEnvironment = "Testing";

    /// <summary>
    /// Adds the upload limits, validated when the host starts, and the image storage. The Testing environment gets the in-memory
    /// storage (Debug builds only, D-07, QUAL-05); every other environment gets the storage that answers 503 until a real one is
    /// set up, so a host without photo keys still starts (RESEARCH Pitfall 22).
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">Application configuration.</param>
    /// <param name="environment">The host environment.</param>
    /// <returns>The same service collection.</returns>
    /// <exception cref="InvalidOperationException">The environment is Testing in a Release build, which has no in-memory storage.</exception>
    public static IServiceCollection AddCspsImages(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(environment);

        services.AddOptions<ImageUploadSettings>()
            .Bind(configuration.GetSection(ImageUploadSettings.SectionName))
            .Validate(settings => settings.Validate() is null, "The Images settings are not valid.")
            .ValidateOnStart();
        services.AddSingleton(provider => provider.GetRequiredService<IOptions<ImageUploadSettings>>().Value);

        if (environment.IsEnvironment(TestingEnvironment))
        {
            AddTestingStorage(services);
        }
        else
        {
            services.TryAddSingleton<IImageStorage, UnconfiguredImageStorage>();
        }

        return services;
    }

    private static void AddTestingStorage(IServiceCollection services)
    {
#if CSPS_TESTING
        services.TryAddSingleton<TestingImageStorage>();
        services.TryAddSingleton<IImageStorage>(provider => provider.GetRequiredService<TestingImageStorage>());
#else
        throw new InvalidOperationException(
            "The Testing environment needs a Debug build: the in-memory image storage is not in Release builds (QUAL-05).");
#endif
    }
}
