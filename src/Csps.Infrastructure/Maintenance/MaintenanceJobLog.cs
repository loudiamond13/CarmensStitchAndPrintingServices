using Csps.Application.Ports;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.Maintenance;

/// <summary>Writes a job that threw to the server log (JOB-01, D-36). The exception travels as data, never in the message.</summary>
/// <param name="logger">The logger.</param>
internal sealed partial class MaintenanceJobLog(ILogger<MaintenanceJobLog> logger) : IMaintenanceJobLog
{
    /// <inheritdoc />
    public void JobFailed(string jobName, Exception exception) => LogJobFailed(logger, exception, jobName);

    /// <inheritdoc />
    public void RemovalFailed(long rowId, string failureCode) => LogRemovalFailed(logger, rowId, failureCode);

    [LoggerMessage(Level = LogLevel.Warning, Message = "A queued photo removal failed. Queue row {RowId}, code {FailureCode}.")]
    private static partial void LogRemovalFailed(ILogger logger, long rowId, string failureCode);

    [LoggerMessage(Level = LogLevel.Error, Message = "The maintenance job {JobName} failed.")]
    private static partial void LogJobFailed(ILogger logger, Exception exception, string jobName);
}
