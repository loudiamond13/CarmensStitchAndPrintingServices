using Csps.Application.Analytics;

namespace Csps.Server.Composition;

/// <summary>Registers the analytics and consent use cases: one handler class per use case, no mediator.</summary>
public static class AnalyticsApplicationRegistration
{
    /// <summary>Adds the analytics handlers as scoped services.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsAnalyticsHandlers(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<RecordConsentHandler>();
        return services;
    }
}
