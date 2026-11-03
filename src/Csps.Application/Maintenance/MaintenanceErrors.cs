using Csps.Domain.Common;

namespace Csps.Application.Maintenance;

/// <summary>The expected failures of a maintenance run (JOB-01), each with its machine code and a plain-English message.</summary>
public static class MaintenanceErrors
{
    /// <summary>The machine code of a run refused because another run holds the lease.</summary>
    public const string RunningCode = "maintenance.running";

    /// <summary>The plain-English text of a run refused because another run holds the lease.</summary>
    public const string RunningMessage = "A maintenance run is already going. Try again in a few minutes.";

    /// <summary>The machine code of a line for a job that threw.</summary>
    public const string JobFailedCode = "maintenance.job-failed";

    /// <summary>The text of a line for a job that threw. The error itself goes to the server log only (D-36).</summary>
    public const string JobFailedText = "The job failed. Check the server log.";

    /// <summary>Gets the 409 for a run that finds the lease taken.</summary>
    public static Error Running { get; } = Error.Conflict(RunningCode, RunningMessage);

    /// <summary>Makes the failed line for a job that threw.</summary>
    /// <param name="jobName">The job's fixed name.</param>
    /// <returns>A failed line with the job name as its label, a fixed text and no error details.</returns>
    public static MaintenanceLine JobFailed(string jobName) => new(jobName, null, true, JobFailedText, JobFailedCode);
}
