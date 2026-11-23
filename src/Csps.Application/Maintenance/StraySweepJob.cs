using Csps.Application.Ports;

namespace Csps.Application.Maintenance;

/// <summary>
/// Reconciles the photo storage with the database on every run (JOB-02, D-23, D-34): it lists this environment's own orders folder and then its
/// own content folder (the photos of the public pages, RESEARCH P-9) and its own quotes folder (quote request photos, INQ-07), and
/// queues every file that no photo row and no removal row knows and that is older than 2 days, up to <see cref="MaxStraysPerRun"/> files
/// per run for all three folders together; when it finds more, it queues the first ones and the run turns red (D-52). The removal job in the same run then removes them. A photo of a soft-deleted order is known, so it is kept. The job never looks outside the folders
/// <c>{RootFolder}/orders/</c>, <c>{RootFolder}/content/</c> and <c>{RootFolder}/quotes/</c>, and it does nothing when the storage is not set up. Lines hold counts and fixed sentences only, never a
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

    /// <summary>The name the content folder pass keeps its place under, apart from the orders pass.</summary>
    public const string ContentCursorName = "stray-sweep-content";

    /// <summary>The name the quotes folder pass keeps its place under, apart from the other passes.</summary>
    public const string QuotesCursorName = "stray-sweep-quotes";

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

        var cutOff = time.GetUtcNow() - MinimumAge;
        var run = new SweepRun();

        // The trailing slash keeps "csps" from matching "csps-dev" (D-07). Each pass keeps its own place: orders, then content (the photos of
        // the public pages), then quotes (private quote photos); any stops the run when the budget is spent, the cap is passed or the storage cannot be read.
        await SweepFolderAsync($"{storage.RootFolder}/orders/", Name, budget, cutOff, run, cancellationToken).ConfigureAwait(false);
        if (!run.Stopped)
        {
            await SweepFolderAsync($"{storage.RootFolder}/content/", ContentCursorName, budget, cutOff, run, cancellationToken).ConfigureAwait(false);
        }

        if (!run.Stopped)
        {
            await SweepFolderAsync($"{storage.RootFolder}/quotes/", QuotesCursorName, budget, cutOff, run, cancellationToken).ConfigureAwait(false);
        }

        var lines = new List<MaintenanceLine> { new(StrayLabel, run.Queued, false, null) };
        if (run.OverCap)
        {
            lines.Add(new MaintenanceLine(LimitLabel, null, true, LimitText));
        }

        if (run.Unreadable)
        {
            lines.Add(new MaintenanceLine(CloudinaryUsageJob.FailedLabel, null, true, UnreadableText));
        }

        return new MaintenanceJobReport(lines, run.More);
    }

    // One folder from its saved place to its last page. A pass that stops early (spent budget, passed cap, unreadable storage) says why on the run.
    private async Task SweepFolderAsync(string folder, string cursorName, MaintenanceBudget budget, DateTimeOffset cutOff, SweepRun run, CancellationToken cancellationToken)
    {
        var saved = await cursors.GetAsync(cursorName, cancellationToken).ConfigureAwait(false);
        var cursor = saved;

        // Where the next run starts; null means a new pass from page 1.
        string? resumeAt = null;

        try
        {
            do
            {
                if (budget.IsSpent)
                {
                    run.More = true;
                    resumeAt = cursor;
                    break;
                }

                var pageStart = cursor;
                var page = await storage.ListAsync(folder, cursor, cancellationToken).ConfigureAwait(false);
                var strays = await FindStraysAsync(page, folder, cutOff, cancellationToken).ConfigureAwait(false);
                var take = (int)Math.Min(strays.Count, MaxStraysPerRun - run.Queued);
                if (take > 0)
                {
                    await queue.EnqueueManyNowAsync(strays.GetRange(0, take), ImageDeletionReason.Stray, cancellationToken).ConfigureAwait(false);
                    run.Queued += take;
                }

                if (strays.Count > take)
                {
                    run.OverCap = true;
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
            run.Unreadable = true;

            // A busy storage or a wrong key says nothing about the place, so it is kept. Any other refusal may mean the cursor is no longer valid.
            resumeAt = failure.FailureCode is ImageFailureCodes.Transient or ImageFailureCodes.Unauthorized ? cursor : null;
        }

        await RememberPlaceAsync(cursorName, saved, resumeAt, cancellationToken).ConfigureAwait(false);
    }

    private async Task RememberPlaceAsync(string cursorName, string? saved, string? resumeAt, CancellationToken cancellationToken)
    {
        if (resumeAt is null)
        {
            if (saved is not null)
            {
                await cursors.ClearAsync(cursorName, cancellationToken).ConfigureAwait(false);
            }
        }
        else if (resumeAt != saved)
        {
            await cursors.SaveAsync(cursorName, resumeAt, cancellationToken).ConfigureAwait(false);
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

    // What one run found so far, across both folders: the cap and the stop reasons belong to the run, not to a folder.
    private sealed class SweepRun
    {
        public long Queued { get; set; }

        public bool More { get; set; }

        public bool Unreadable { get; set; }

        public bool OverCap { get; set; }

        public bool Stopped => More || Unreadable || OverCap;
    }
}
