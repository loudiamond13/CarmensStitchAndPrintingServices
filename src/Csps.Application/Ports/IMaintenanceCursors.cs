namespace Csps.Application.Ports;

/// <summary>
/// Keeps the place a maintenance job reached in a long listing, so the next run carries on from there instead of page 1 (D-54).
/// One place is kept per job name. The value is the storage's own paging cursor, so it is never logged or shown.
/// </summary>
public interface IMaintenanceCursors
{
    /// <summary>Reads the saved place of a job.</summary>
    /// <param name="jobName">The job's fixed name.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The saved cursor, or null when the job has none.</returns>
    Task<string?> GetAsync(string jobName, CancellationToken cancellationToken);

    /// <summary>Saves the place of a job, replacing any earlier one.</summary>
    /// <param name="jobName">The job's fixed name.</param>
    /// <param name="cursor">The cursor to resume from.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    /// <returns>A task that completes once the place is saved.</returns>
    Task SaveAsync(string jobName, string cursor, CancellationToken cancellationToken);

    /// <summary>Forgets the place of a job, so its next pass starts at the beginning.</summary>
    /// <param name="jobName">The job's fixed name.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    /// <returns>A task that completes once the place is cleared.</returns>
    Task ClearAsync(string jobName, CancellationToken cancellationToken);
}
