using Csps.Application.Content;

namespace Csps.Server.Composition;

/// <summary>Registers the public site content use cases: one handler class per use case, no mediator.</summary>
public static class ContentApplicationRegistration
{
    /// <summary>Adds the public content handlers as scoped services.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsContentHandlers(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<GetPublicSiteHandler>();
        return services;
    }
}
