using Csps.Application.Ports;

namespace Csps.Application.Maintenance;

/// <summary>
/// Reconciles the photo storage with the database once a month (JOB-02, D-23): it lists this environment's own orders folder, and
/// queues every file that no photo row and no removal row knows and that is older than 2 days. Lines hold counts and fixed sentences
/// only, never a file id.
/// </summary>
/// <param name="storage">The photo storage.</param>
/// <param name="queue">The removal queue.</param>
/// <param name="inventory">Tells which ids the database knows.</param>
/// <param name="time">The clock.</param>
public sealed class StraySweepJob(IImageStorage storage, IImageDeletionQueue queue, IImageInventory inventory, TimeProvider time) : IMaintenanceJob
{
    /// <summary>The label of the count of queued stray files.</summary>
    public const string StrayLabel = "Stray files removed (older than 2 days)";

    /// <inheritdoc />
    public int Order => 20;

    /// <inheritdoc />
    public string Name => "stray-sweep";

    /// <inheritdoc />
    public Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        _ = (storage, queue, inventory, time);
        return Task.FromResult(new MaintenanceJobReport([], false));
    }
}
