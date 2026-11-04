using Csps.Application.Ports;

namespace Csps.Application.Maintenance;

/// <summary>
/// Removes the queued photo files from the photo storage (JOB-02, D-05, D-22). It takes due rows 25 at a time, each with its own
/// 5 minute lease, asks the storage to remove the file and clear its cached copies, and deletes the row. A transient answer is tried
/// again twice, after 2 and then 8 seconds. A row that still fails keeps its place with one more attempt and its failure code, and the
/// run turns red. Keys the storage refuses stop the job at once. Lines hold counts and fixed sentences only, never a file id.
/// </summary>
/// <param name="storage">The photo storage.</param>
/// <param name="queue">The removal queue.</param>
/// <param name="time">The clock, also used for the retry waits.</param>
/// <param name="log">Records a failed removal by row id and code.</param>
public sealed class ImageRemovalJob(IImageStorage storage, IImageDeletionQueue queue, TimeProvider time, IMaintenanceJobLog log) : IMaintenanceJob
{
    /// <summary>The label of the count of removed photos.</summary>
    public const string RemovedLabel = "Photos removed from storage";

    /// <summary>The label of the count of removals that still fail.</summary>
    public const string FailingLabel = "Photo removals still failing";

    /// <summary>The text of the line for removals that still fail.</summary>
    public const string FailingText = "The rows stay queued. The server log has the codes.";

    /// <summary>The failed line for keys the storage refuses.</summary>
    public const string KeysRefusedText = "Cloudinary refused the keys. Check the Cloudinary settings.";

    /// <summary>The label of the line for storage that is not set up.</summary>
    public const string NotRunLabel = "Photo removals not run";

    /// <summary>The text of the line for storage that is not set up.</summary>
    public const string NotRunText = "photo storage is not set up.";

    /// <summary>The failure code of a queued file outside this environment's own orders folder. It is never removed.</summary>
    public const string OutsideFolderCode = "outside-folder";

    /// <summary>The most rows one claim takes.</summary>
    public const int ClaimSize = 25;

    /// <summary>How long a run holds a row before another run may take it.</summary>
    public static readonly TimeSpan Lease = TimeSpan.FromMinutes(5);

    // The waits before the second and the third try.
    private static readonly TimeSpan[] RetryWaits = [TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(8)];

    private enum Step
    {
        Removed,
        Failed,
        KeysRefused,
    }

    /// <inheritdoc />
    public int Order => 30;

    /// <inheritdoc />
    public string Name => "image-removal";

    /// <inheritdoc />
    public async Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(budget);

        if (!storage.IsConfigured)
        {
            return new MaintenanceJobReport([new MaintenanceLine(NotRunLabel, null, false, NotRunText)], false);
        }

        var holder = Guid.NewGuid();
        var startedAt = time.GetUtcNow();
        var folder = $"{storage.RootFolder}/orders/";
        var held = new HashSet<long>();
        long removed = 0;
        long failing = 0;
        var more = false;
        var keysRefused = false;

        try
        {
            while (!more && !keysRefused)
            {
                if (budget.IsSpent)
                {
                    more = true;
                    break;
                }

                var claimed = await queue.ClaimDueAsync(holder, startedAt, Lease, ClaimSize, cancellationToken).ConfigureAwait(false);
                held.UnionWith(claimed.Select(static row => row.Id));
                foreach (var row in claimed)
                {
                    if (budget.IsSpent)
                    {
                        more = true;
                        break;
                    }

                    var step = await RemoveRowAsync(row, holder, folder, startedAt, cancellationToken).ConfigureAwait(false);
                    if (step == Step.KeysRefused)
                    {
                        keysRefused = true;
                        break;
                    }

                    held.Remove(row.Id);
                    if (step == Step.Removed)
                    {
                        removed++;
                    }
                    else
                    {
                        failing++;
                    }
                }

                if (claimed.Count < ClaimSize)
                {
                    break;
                }
            }
        }
        finally
        {
            // Rows this run took but did not get to are let go at once, so the next call can take them instead of waiting out the lease.
            if (held.Count > 0)
            {
                await queue.ReleaseAsync([.. held], holder, CancellationToken.None).ConfigureAwait(false);
            }
        }

        var lines = new List<MaintenanceLine> { new(RemovedLabel, removed, false, null) };
        if (failing > 0)
        {
            lines.Add(new MaintenanceLine(FailingLabel, failing, true, FailingText));
        }

        if (keysRefused)
        {
            lines.Add(new MaintenanceLine(CloudinaryUsageJob.FailedLabel, null, true, KeysRefusedText));
        }

        return new MaintenanceJobReport(lines, more);
    }

    private async Task<Step> RemoveRowAsync(QueuedRemoval row, Guid holder, string folder, DateTimeOffset startedAt, CancellationToken cancellationToken)
    {
        // A file outside this environment's own orders folder is never removed, whatever the row says (D-07).
        if (!row.PublicId.StartsWith(folder, StringComparison.Ordinal))
        {
            await FailRowAsync(row, holder, OutsideFolderCode, startedAt, cancellationToken).ConfigureAwait(false);
            return Step.Failed;
        }

        var outcome = await RemoveWithRetriesAsync(row.PublicId, cancellationToken).ConfigureAwait(false);
        switch (outcome.Status)
        {
            case ImageRemovalStatus.Removed:
            case ImageRemovalStatus.NotFound:
                await queue.CompleteAsync(row.Id, holder, cancellationToken).ConfigureAwait(false);
                return Step.Removed;
            case ImageRemovalStatus.Rejected when outcome.FailureCode == ImageFailureCodes.Unauthorized:
                return Step.KeysRefused;
            default:
                var code = outcome.FailureCode ?? outcome.Status.ToString().ToLowerInvariant();
                await FailRowAsync(row, holder, code, startedAt, cancellationToken).ConfigureAwait(false);
                return Step.Failed;
        }
    }

    // Up to three tries: a transient answer waits 2 seconds, then 8 seconds, through the clock so tests never really wait.
    private async Task<ImageRemovalOutcome> RemoveWithRetriesAsync(string publicId, CancellationToken cancellationToken)
    {
        var outcome = await storage.RemoveAsync(publicId, cancellationToken).ConfigureAwait(false);
        for (var retry = 0; retry < RetryWaits.Length && outcome.Status == ImageRemovalStatus.Transient; retry++)
        {
            await Task.Delay(RetryWaits[retry], time, cancellationToken).ConfigureAwait(false);
            outcome = await storage.RemoveAsync(publicId, cancellationToken).ConfigureAwait(false);
        }

        return outcome;
    }

    // The failure time is always after the run's start, so the failed row is not due again until the next run.
    private async Task FailRowAsync(QueuedRemoval row, Guid holder, string code, DateTimeOffset startedAt, CancellationToken cancellationToken)
    {
        var failedAt = time.GetUtcNow();
        if (failedAt <= startedAt)
        {
            failedAt = startedAt.AddTicks(1);
        }

        await queue.FailAsync(row.Id, holder, code, failedAt, cancellationToken).ConfigureAwait(false);
        log.RemovalFailed(row.Id, code);
    }
}
