using Csps.Application.Maintenance;
using Csps.Application.Ports;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.Maintenance;

/// <summary>Registers the maintenance jobs (JOB-01). A later phase adds a job by registering one more <see cref="IMaintenanceJob"/> here.</summary>
public static class MaintenanceRegistration
{
    /// <summary>Adds the jobs as scoped services; the runner finds them all and orders them itself.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsMaintenance(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<IMaintenanceRunLock, MaintenanceRunLock>();
        services.AddScoped<IMaintenanceJobLog, MaintenanceJobLog>();
        services.AddScoped<IMaintenanceJob, PurgeExpiredRecordsJob>();
        return services;
    }
}
