namespace Csps.Application.Ports;

/// <summary>Writes the server-side record of a job that threw, so the run answer never carries the error (D-36).</summary>
public interface IMaintenanceJobLog
{
    /// <summary>Records that a job threw. The details go to the server log only.</summary>
    /// <param name="jobName">The job's fixed name.</param>
    /// <param name="exception">What the job threw.</param>
    void JobFailed(string jobName, Exception exception);

    /// <summary>Records that a queued photo removal failed. Only the row id and a short code are written, never the file's public id.</summary>
    /// <param name="rowId">The id of the queue row.</param>
    /// <param name="failureCode">A short code naming the cause.</param>
    void RemovalFailed(long rowId, string failureCode);

    /// <summary>Records that a job could not read the photo storage, so the operator can tell a wrong key from a timeout.</summary>
    /// <param name="jobName">The job's fixed name.</param>
    /// <param name="failureCode">A short code naming the cause, such as <c>transient</c> or <c>unauthorized</c>.</param>
    void StorageReadFailed(string jobName, string failureCode);
}
