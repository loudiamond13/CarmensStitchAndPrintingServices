namespace Csps.Application.Maintenance;

/// <summary>
/// One short maintenance job that the keyed run endpoint calls (JOB-01). A job registers itself as a scoped service, so adding a job
/// never touches the runner. A job reports counts and fixed labels only, never an id, an address or an error body (D-36).
/// </summary>
public interface IMaintenanceJob
{
    /// <summary>Gets where the job runs in a pass: purge 10, stray sweep 20, removals 30, usage 40. Lower runs first.</summary>
    int Order { get; }

    /// <summary>Gets a short fixed name, used to order jobs that share an <see cref="Order"/> and in server logs.</summary>
    string Name { get; }

    /// <summary>Runs the job once.</summary>
    /// <param name="budget">The time left for the whole pass.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The lines to show and whether more work is left for another pass.</returns>
    Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken);
}

/// <summary>What one job did in one pass.</summary>
/// <param name="Lines">The plain-English result lines, counts only.</param>
/// <param name="More">True when the job stopped early and has more work for another pass.</param>
public sealed record MaintenanceJobReport(IReadOnlyList<MaintenanceLine> Lines, bool More);
