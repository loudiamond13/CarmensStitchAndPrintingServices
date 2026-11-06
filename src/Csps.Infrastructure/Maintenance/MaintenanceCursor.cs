namespace Csps.Infrastructure.Maintenance;

/// <summary>
/// One row of the MaintenanceCursors table (D-54): the place a maintenance job reached in a long storage listing, so the next run
/// resumes there. There is one row per job and none while the job has no place to keep. It has no row version: only the run that holds
/// the maintenance lease writes it, and a conflict would only fail a run for no reason.
/// </summary>
public sealed class MaintenanceCursor
{
    /// <summary>The longest job name.</summary>
    public const int JobNameMaxLength = 50;

    /// <summary>The longest cursor the table keeps.</summary>
    public const int CursorMaxLength = 500;

    private MaintenanceCursor()
    {
        JobName = string.Empty;
        Position = string.Empty;
    }

    /// <summary>Gets the job's fixed name, the primary key.</summary>
    public string JobName { get; private set; }

    /// <summary>Gets the storage's paging cursor to resume from.</summary>
    public string Position { get; private set; }

    /// <summary>Gets when the place was last saved.</summary>
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    /// <summary>Creates a row for a job's place.</summary>
    /// <param name="jobName">The job's fixed name.</param>
    /// <param name="cursor">The cursor to resume from.</param>
    /// <param name="now">The current UTC time.</param>
    /// <returns>The new, unsaved row.</returns>
    public static MaintenanceCursor Keep(string jobName, string cursor, DateTimeOffset now)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(jobName);
        ArgumentException.ThrowIfNullOrWhiteSpace(cursor);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(jobName.Length, JobNameMaxLength);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(cursor.Length, CursorMaxLength);

        return new MaintenanceCursor { JobName = jobName, Position = cursor, UpdatedAtUtc = now };
    }
}
