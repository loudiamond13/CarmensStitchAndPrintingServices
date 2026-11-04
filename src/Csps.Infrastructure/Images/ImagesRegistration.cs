using Csps.Application.Images;
using Csps.Application.Ports;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Polly;

namespace Csps.Infrastructure.Images;

/// <summary>Registers the image storage and the upload limits (IMG-01, IMG-02).</summary>
public static class ImagesRegistration
{
    private const string TestingEnvironment = "Testing";

    // Well under the 2 minute idempotency claim lease (RESEARCH Pitfall 20).
    private static readonly TimeSpan CloudinaryTimeout = TimeSpan.FromSeconds(60);

    /// <summary>
    /// Adds the upload limits, validated when the host starts, the image storage and the address builder. The Testing environment
    /// gets the in-memory storage and same-origin addresses (Debug builds only, D-07, QUAL-05). Every other environment gets the
    /// Cloudinary storage when the cloud name, key and secret are all set, and the storage that answers 503 otherwise, so a host
    /// without photo keys still starts (RESEARCH Pitfall 22). They also get the Cloudinary address builder, whose root folder is checked against the environment before the host serves anything (D-07).
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
            AddTestingServices(services);
        }
        else
        {
            AddCloudinaryDelivery(services, configuration, environment);
            AddCloudinaryStorage(services);
        }

        return services;
    }

    private static void AddCloudinaryDelivery(IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        services.AddSingleton<IValidateOptions<CloudinarySettings>>(new CloudinarySettings.Validator(environment.EnvironmentName));
        services.AddOptions<CloudinarySettings>()
            .Bind(configuration.GetSection(CloudinarySettings.SectionName))
            .ValidateOnStart();
        services.TryAddSingleton<IImageDelivery, CloudinaryImageDelivery>();
    }

    private static void AddCloudinaryStorage(IServiceCollection services)
    {
        // Timeouts only: a consumed upload stream cannot be sent twice, so there is no automatic retry (RESEARCH Pitfall 20).
        services.AddHttpClient(CloudinaryImageStorage.HttpClientName)
            .AddResilienceHandler(CloudinaryImageStorage.HttpClientName, pipeline => pipeline.AddTimeout(CloudinaryTimeout));

        // The three keys decide, so a host without them still starts and the upload answers 503 (D-06).
        services.TryAddSingleton<IImageStorage>(provider => provider.GetRequiredService<IOptions<CloudinarySettings>>().Value.IsConfigured
            ? ActivatorUtilities.CreateInstance<CloudinaryImageStorage>(provider)
            : new UnconfiguredImageStorage());
    }

    private static void AddTestingServices(IServiceCollection services)
    {
#if CSPS_TESTING
        services.TryAddSingleton<TestingImageStorage>();
        services.TryAddSingleton<IImageStorage>(provider => provider.GetRequiredService<TestingImageStorage>());
        services.TryAddSingleton<IImageDelivery, TestingImageDelivery>();
#else
        throw new InvalidOperationException(
            "The Testing environment needs a Debug build: the in-memory image storage is not in Release builds (QUAL-05).");
#endif
    }
}
