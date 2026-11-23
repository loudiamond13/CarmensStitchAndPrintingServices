using Csps.Application.Maintenance;
using Csps.Application.Ports;
using Csps.Domain.QuoteRequests;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.Maintenance;

/// <summary>
/// Removes quote requests that never became orders once they are older than the retention period (INQ-07, Phase 12 D-02, D-07, D-22).
/// A Converted request is never removed by age. Each batch queues every stored photo for removal and deletes the requests in one
/// transaction, so a failure leaves both untouched. The photo rows go with their request. The job runs before the photo removal job, so
/// the files leave the storage in the same run. A database failure is logged and reported as the failed line, and the run never throws for it.
/// </summary>
/// <param name="context">The database context, shared with the removal queue.</param>
/// <param name="calendar">The business calendar (Asia/Manila by default).</param>
/// <param name="queue">The photo removal queue, on the same context.</param>
/// <param name="logger">The logger.</param>
internal sealed partial class QuoteRequestRetentionJob(
    CspsDbContext context,
    IBusinessCalendar calendar,
    IImageDeletionQueue queue,
    ILogger<QuoteRequestRetentionJob> logger) : IMaintenanceJob
{
    internal const string RemovedLabel = "Old quote requests removed";

    internal const string FailedText = "The old quote requests could not be removed.";

    internal const string JobName = "quote-request-retention";

    internal const int BatchSize = 200;

    /// <inheritdoc />
    public int Order => 12;

    /// <inheritdoc />
    public string Name => JobName;

    /// <inheritdoc />
    public async Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(budget);

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var cut = QuoteRequestRetention.PurgeBefore(clock.Today, clock.Zone);
        try
        {
            var (count, more) = await DrainAsync(cut, budget, cancellationToken).ConfigureAwait(false);
            return new MaintenanceJobReport([new MaintenanceLine(RemovedLabel, count, false, null)], more);
        }
        catch (Exception exception) when (SqlErrors.IsDatabaseFailure(exception))
        {
            context.ChangeTracker.Clear();
            LogRemovalFailed(logger, exception);
            return new MaintenanceJobReport([new MaintenanceLine(RemovedLabel, null, true, FailedText)], false);
        }
    }

    // Removes one batch at a time. A full batch may mean more requests are left: the budget is checked then, and a spent budget ends the run with More.
    private async Task<(long Count, bool More)> DrainAsync(DateTimeOffset cut, MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        long removed = 0;
        while (true)
        {
            var batch = await RemoveBatchAsync(cut, cancellationToken).ConfigureAwait(false);
            if (batch < 0)
            {
                // A request changed under the batch (it was converted, or another run took it), so the batch was rolled back. The next run starts afresh.
                return (removed, true);
            }

            removed += batch;
            if (batch < BatchSize)
            {
                return (removed, false);
            }

            if (budget.IsSpent)
            {
                return (removed, true);
            }
        }
    }

    // One batch in one transaction: queue the stored photos, then delete the requests. Returns the number removed, or -1 when the batch was rolled back.
    private async Task<int> RemoveBatchAsync(DateTimeOffset cut, CancellationToken cancellationToken)
    {
        var transaction = await context.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            var ids = await context.QuoteRequests
                .AsNoTracking()
                .Where(request => request.Status != QuoteRequestStatus.Converted && request.CreatedAtUtc < cut)
                .OrderBy(request => request.CreatedAtUtc)
                .ThenBy(request => request.Id)
                .Take(BatchSize)
                .Select(request => request.Id)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
            if (ids.Count == 0)
            {
                return 0;
            }

            var files = await context.QuoteRequestPhotos
                .AsNoTracking()
                .Where(photo => ids.Contains(photo.QuoteRequestId) && photo.PublicId != null)
                .Select(photo => photo.PublicId!)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
            foreach (var file in files)
            {
                queue.Enqueue(file, ImageDeletionReason.QuotePurged);
            }

            await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            context.ChangeTracker.Clear();

            var deleted = await context.QuoteRequests
                .Where(request => ids.Contains(request.Id) && request.Status != QuoteRequestStatus.Converted)
                .ExecuteDeleteAsync(cancellationToken)
                .ConfigureAwait(false);
            if (deleted != ids.Count)
            {
                return -1;
            }

            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return deleted;
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "The old quote requests could not be removed.")]
    private static partial void LogRemovalFailed(ILogger logger, Exception exception);
}
