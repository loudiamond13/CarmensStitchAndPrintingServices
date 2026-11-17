using Csps.Application.Ports;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.Analytics;

/// <summary>Registers the analytics and consent stores (Phase 12).</summary>
public static class AnalyticsRegistration
{
    /// <summary>Adds the analytics stores as scoped services. Later plans add the visit and roll-up stores here.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsAnalytics(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<IConsentRecords, ConsentRecords>();
        services.AddScoped<IPageViewCounts, PageViewCounts>();
        services.AddScoped<IAnalyticsVisits, AnalyticsVisits>();
        return services;
    }
}
