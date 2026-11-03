using Csps.Application.Ports;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.Maintenance;

/// <summary>Writes a job that threw to the server log (JOB-01, D-36). The exception travels as data, never in the message.</summary>
/// <param name="logger">The logger.</param>
internal sealed partial class MaintenanceJobLog(ILogger<MaintenanceJobLog> logger) : IMaintenanceJobLog
{
    /// <inheritdoc />
    public void JobFailed(string jobName, Exception exception) => LogJobFailed(logger, exception, jobName);

    [LoggerMessage(Level = LogLevel.Error, Message = "The maintenance job {JobName} failed.")]
    private static partial void LogJobFailed(ILogger logger, Exception exception, string jobName);
}
