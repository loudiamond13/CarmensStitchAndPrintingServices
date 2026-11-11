using Csps.Application.Ports;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.Dashboard;

/// <summary>Registers the dashboard services.</summary>
public static class DashboardRegistration
{
    /// <summary>Adds the dashboard reader.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsDashboard(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<IDashboardReader, DashboardReader>();
        return services;
    }
}
