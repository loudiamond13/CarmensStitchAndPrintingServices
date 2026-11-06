using Csps.Application.Ports;

namespace Csps.Application.Maintenance;

/// <summary>
/// Reconciles the photo storage with the database once a month (JOB-02, D-23): it lists this environment's own orders folder, and
/// queues every file that no photo row and no removal row knows and that is older than 2 days, up to <see cref="MaxStraysPerRun"/> files
/// per run; when it finds more, it queues the first ones and the run turns red (D-52). The removal job in the same run then removes them. A photo of a soft-deleted order is known, so it is kept. The job never looks outside the folder
/// <c>{RootFolder}/orders/</c>, and it does nothing when the storage is not set up. Lines hold counts and fixed sentences only, never a
/// file id.
/// </summary>
/// <param name="storage">The photo storage.</param>
/// <param name="queue">The removal queue.</param>
/// <param name="inventory">Tells which ids the database knows.</param>
/// <param name="cursors">Keeps the listing place between runs.</param>
/// <param name="time">The clock.</param>
/// <param name="log">The server log for a storage read that failed.</param>
public sealed class StraySweepJob(IImageStorage storage, IImageDeletionQueue queue, IImageInventory inventory, IMaintenanceCursors cursors, TimeProvider time, IMaintenanceJobLog log) : IMaintenanceJob
{
    /// <summary>The label of the count of queued stray files.</summary>
    public const string StrayLabel = "Stray files removed (older than 2 days)";

    /// <summary>The label of the line for storage that is not set up.</summary>
    public const string NotRunLabel = "Stray file sweep not run";

    /// <summary>The text of the line for storage that is not set up.</summary>
    public const string NotRunText = "photo storage is not set up.";

    /// <summary>The failed line for a listing that could not be read.</summary>
    public const string UnreadableText = "The stray file sweep could not read the photo storage.";

    /// <summary>The most stray files one run queues (D-52). More than this turns the run red, so the owner checks before more photos go.</summary>
    public const int MaxStraysPerRun = 50;

    /// <summary>The label of the failed line for a run that found more strays than the cap.</summary>
    public const string LimitLabel = "Stray file limit";

    /// <summary>The failed line for a run that found more strays than the cap.</summary>
    public const string LimitText = "More than 50 stray files were found, so only the first 50 were queued for removal. Check the photo storage and the database before the next run.";

    /// <summary>A file younger than this is never swept: an upload may still be saving its photo row.</summary>
    public static readonly TimeSpan MinimumAge = TimeSpan.FromDays(2);

    /// <inheritdoc />
    public int Order => 20;

    /// <inheritdoc />
    public string Name => "stray-sweep";

    /// <inheritdoc />
    public async Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(budget);

        if (!storage.IsConfigured)
        {
            return new MaintenanceJobReport([new MaintenanceLine(NotRunLabel, null, false, NotRunText)], false);
        }

        // The trailing slash keeps "csps" from matching "csps-dev" (D-07).
        var folder = $"{storage.RootFolder}/orders/";
        var cutOff = time.GetUtcNow() - MinimumAge;
        long queued = 0;
        var more = false;
        var unreadable = false;
        var overCap = false;
        var saved = await cursors.GetAsync(Name, cancellationToken).ConfigureAwait(false);
        var cursor = saved;

        // Where the next run starts; null means a new pass from page 1.
        string? resumeAt = null;

        try
        {
            do
            {
                if (budget.IsSpent)
                {
                    more = true;
                    resumeAt = cursor;
                    break;
                }

                var pageStart = cursor;
                var page = await storage.ListAsync(folder, cursor, cancellationToken).ConfigureAwait(false);
                var strays = await FindStraysAsync(page, folder, cutOff, cancellationToken).ConfigureAwait(false);
                var take = (int)Math.Min(strays.Count, MaxStraysPerRun - queued);
                if (take > 0)
                {
                    await queue.EnqueueManyNowAsync(strays.GetRange(0, take), ImageDeletionReason.Stray, cancellationToken).ConfigureAwait(false);
                    queued += take;
                }

                if (strays.Count > take)
                {
                    overCap = true;
                    resumeAt = pageStart;
                    break;
                }

                cursor = page.NextCursor;
            }
            while (cursor is not null);
        }
        catch (ImageStorageException failure)
        {
            log.StorageReadFailed(Name, failure.FailureCode);
            unreadable = true;

            // A busy storage or a wrong key says nothing about the place, so it is kept. Any other refusal may mean the cursor is no longer valid.
            resumeAt = failure.FailureCode is ImageFailureCodes.Transient or ImageFailureCodes.Unauthorized ? cursor : null;
        }

        await RememberPlaceAsync(saved, resumeAt, cancellationToken).ConfigureAwait(false);

        var lines = new List<MaintenanceLine> { new(StrayLabel, queued, false, null) };
        if (overCap)
        {
            lines.Add(new MaintenanceLine(LimitLabel, null, true, LimitText));
        }

        if (unreadable)
        {
            lines.Add(new MaintenanceLine(CloudinaryUsageJob.FailedLabel, null, true, UnreadableText));
        }

        return new MaintenanceJobReport(lines, more);
    }

    private async Task RememberPlaceAsync(string? saved, string? resumeAt, CancellationToken cancellationToken)
    {
        if (resumeAt is null)
        {
            if (saved is not null)
            {
                await cursors.ClearAsync(Name, cancellationToken).ConfigureAwait(false);
            }
        }
        else if (resumeAt != saved)
        {
            await cursors.SaveAsync(Name, resumeAt, cancellationToken).ConfigureAwait(false);
        }
    }

    // Only files of the own folder that are old enough are checked against the database; the rest are left alone.
    private async Task<List<string>> FindStraysAsync(StoredImagePage page, string folder, DateTimeOffset cutOff, CancellationToken cancellationToken)
    {
        var candidates = page.Entries
            .Where(entry => entry.PublicId.StartsWith(folder, StringComparison.Ordinal) && entry.CreatedAtUtc <= cutOff)
            .Select(static entry => entry.PublicId)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (candidates.Count == 0)
        {
            return candidates;
        }

        var known = await inventory.KnownAsync(candidates, cancellationToken).ConfigureAwait(false);
        return [.. candidates.Where(candidate => !known.Contains(candidate))];
    }
}
