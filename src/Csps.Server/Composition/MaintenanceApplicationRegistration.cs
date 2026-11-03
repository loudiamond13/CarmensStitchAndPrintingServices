using Csps.Application.Maintenance;

namespace Csps.Server.Composition;

/// <summary>Registers the maintenance use case: one handler class, no mediator.</summary>
public static class MaintenanceApplicationRegistration
{
    /// <summary>Adds the run handler as a scoped service.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsMaintenanceHandlers(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<RunMaintenanceHandler>();
        return services;
    }
}
