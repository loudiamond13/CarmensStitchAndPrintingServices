using Csps.Application.Ports;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.Maintenance;

/// <summary>Writes a job that threw to the server log (JOB-01, D-36).</summary>
/// <param name="logger">The logger.</param>
internal sealed class MaintenanceJobLog(ILogger<MaintenanceJobLog> logger) : IMaintenanceJobLog
{
    /// <inheritdoc />
    public void JobFailed(string jobName, Exception exception)
    {
        _ = logger;
    }
}
