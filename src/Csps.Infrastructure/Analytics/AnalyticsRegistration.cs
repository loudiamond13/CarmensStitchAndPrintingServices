using Csps.Application.Ports;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.Analytics;

/// <summary>Registers the analytics stores: the daily page count and the stats reader.</summary>
public static class AnalyticsRegistration
{
    /// <summary>Adds the analytics stores as scoped services.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsAnalytics(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<IPageViewCounts, PageViewCounts>();
        services.AddScoped<IVisitorStatsReader, VisitorStatsReader>();
#if CSPS_TESTING
        services.AddScoped<TestingAnalyticsSeeder>();
#endif
        return services;
    }
}
