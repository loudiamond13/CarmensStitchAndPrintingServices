using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Csps.Infrastructure.Images;

/// <summary>Registers the image storage (IMG-01).</summary>
public static class ImagesRegistration
{
    /// <summary>Adds the image storage.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsImages(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);
#if CSPS_TESTING
        services.TryAddSingleton<TestingImageStorage>();
#endif
        return services;
    }
}
