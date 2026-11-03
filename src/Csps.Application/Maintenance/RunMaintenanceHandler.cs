using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Maintenance;

/// <summary>Use case: the keyed maintenance call runs every registered job in order and answers plain counts (JOB-01, D-36).</summary>
/// <param name="jobs">Every registered job, in any order.</param>
/// <param name="time">The clock for the lease and the pass budget.</param>
/// <param name="runLock">The lease that lets one run work at a time.</param>
/// <param name="log">Records a job that threw, on the server only.</param>
public sealed class RunMaintenanceHandler(IEnumerable<IMaintenanceJob> jobs, TimeProvider time, IMaintenanceRunLock runLock, IMaintenanceJobLog log)
{
    /// <summary>Takes the run lease, then runs the jobs by <see cref="IMaintenanceJob.Order"/>, then by name, whatever their registration order.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The lines of every job; ok when no line failed; more when any job has work left. The running conflict when another run holds the lease.
    /// </returns>
    public async Task<Result<MaintenanceRunResponse>> HandleAsync(CancellationToken cancellationToken)
    {
        _ = log;
        var holder = Guid.NewGuid();
        if (!await runLock.TryTakeAsync(holder, time.GetUtcNow(), cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<MaintenanceRunResponse>(MaintenanceErrors.Running);
        }

        try
        {
            var budget = new MaintenanceBudget(time);
            var lines = new List<MaintenanceLine>();
            var more = false;

            foreach (var job in jobs.OrderBy(static job => job.Order).ThenBy(static job => job.Name, StringComparer.Ordinal))
            {
                var report = await job.RunAsync(budget, cancellationToken).ConfigureAwait(false);
                lines.AddRange(report.Lines);
                more |= report.More;
            }

            return Result.Success(new MaintenanceRunResponse(lines.TrueForAll(static line => !line.Failed), more, lines));
        }
        finally
        {
            await runLock.ReleaseAsync(holder, CancellationToken.None).ConfigureAwait(false);
        }
    }
}
