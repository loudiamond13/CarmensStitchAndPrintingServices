using Csps.Application.Ports;

namespace Csps.Application.Maintenance;

/// <summary>
/// Removes the queued photo files from the photo storage (JOB-02, D-05). It takes due rows 25 at a time, each with its own 5 minute
/// lease, asks the storage to remove the file and clear its cached copies, and deletes the row. Lines hold counts and fixed sentences
/// only, never a file id.
/// </summary>
/// <param name="storage">The photo storage.</param>
/// <param name="queue">The removal queue.</param>
/// <param name="time">The clock.</param>
public sealed class ImageRemovalJob(IImageStorage storage, IImageDeletionQueue queue, TimeProvider time) : IMaintenanceJob
{
    /// <summary>The label of the count of removed photos.</summary>
    public const string RemovedLabel = "Photos removed from storage";

    /// <summary>The most rows one claim takes.</summary>
    public const int ClaimSize = 25;

    /// <summary>How long a run holds a row before another run may take it.</summary>
    public static readonly TimeSpan Lease = TimeSpan.FromMinutes(5);

    /// <inheritdoc />
    public int Order => 30;

    /// <inheritdoc />
    public string Name => "image-removal";

    /// <inheritdoc />
    public async Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(budget);

        var holder = Guid.NewGuid();
        var startedAt = time.GetUtcNow();
        long removed = 0;
        while (true)
        {
            var claimed = await queue.ClaimDueAsync(holder, startedAt, Lease, ClaimSize, cancellationToken).ConfigureAwait(false);
            foreach (var row in claimed)
            {
                var outcome = await storage.RemoveAsync(row.PublicId, cancellationToken).ConfigureAwait(false);
                if (outcome.Status is ImageRemovalStatus.Removed or ImageRemovalStatus.NotFound)
                {
                    await queue.CompleteAsync(row.Id, holder, cancellationToken).ConfigureAwait(false);
                    removed++;
                }
            }

            if (claimed.Count < ClaimSize)
            {
                return new MaintenanceJobReport([new MaintenanceLine(RemovedLabel, removed, false, null)], false);
            }
        }
    }
}
