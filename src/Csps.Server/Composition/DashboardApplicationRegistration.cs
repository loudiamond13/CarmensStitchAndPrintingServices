using Csps.Application.Dashboard;
using FluentValidation;

namespace Csps.Server.Composition;

/// <summary>Registers the dashboard use cases: one handler class per use case, no mediator.</summary>
public static class DashboardApplicationRegistration
{
    /// <summary>Adds the dashboard handlers as scoped services and their validators as singletons.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsDashboardHandlers(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddSingleton<IValidator<GetDashboardChartRequest>, GetDashboardChartRequestValidator>();
        services.AddScoped<GetDashboardSummaryHandler>();
        services.AddScoped<GetDashboardChartHandler>();
        return services;
    }
}
