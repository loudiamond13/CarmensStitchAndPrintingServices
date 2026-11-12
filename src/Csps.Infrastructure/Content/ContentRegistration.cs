using Csps.Application.Ports;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.Content;

/// <summary>Registers the public content services.</summary>
public static class ContentRegistration
{
    /// <summary>Adds the public content reader and the cache it is cleared through.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsContent(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddSingleton<IPublicContentReader, PublicContentReader>();
        services.AddSingleton<IPublicContentCache, PublicContentCache>();
#if CSPS_TESTING
        services.AddScoped<TestingSiteContentSeeder>();
#endif
        return services;
    }
}
