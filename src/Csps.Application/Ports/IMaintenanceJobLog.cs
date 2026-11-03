namespace Csps.Application.Ports;

/// <summary>Writes the server-side record of a job that threw, so the run answer never carries the error (D-36).</summary>
public interface IMaintenanceJobLog
{
    /// <summary>Records that a job threw. The details go to the server log only.</summary>
    /// <param name="jobName">The job's fixed name.</param>
    /// <param name="exception">What the job threw.</param>
    void JobFailed(string jobName, Exception exception);
}
