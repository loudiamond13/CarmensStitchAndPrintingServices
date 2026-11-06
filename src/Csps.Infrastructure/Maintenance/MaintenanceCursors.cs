using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Maintenance;

/// <summary>
/// Keeps a job's listing place in the MaintenanceCursors table (D-54). A cursor longer than the column is not kept: the job then starts
/// a new pass next time, which is slower but never wrong.
/// </summary>
/// <param name="context">The database context.</param>
/// <param name="time">The clock.</param>
internal sealed class MaintenanceCursors(CspsDbContext context, TimeProvider time) : IMaintenanceCursors
{
    /// <inheritdoc />
    public async Task<string?> GetAsync(string jobName, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(jobName);

        return await context.Set<MaintenanceCursor>()
            .AsNoTracking()
            .Where(row => row.JobName == jobName)
            .Select(row => row.Position)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task SaveAsync(string jobName, string cursor, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(jobName);
        ArgumentException.ThrowIfNullOrWhiteSpace(cursor);

        if (cursor.Length > MaintenanceCursor.CursorMaxLength)
        {
            await ClearAsync(jobName, cancellationToken).ConfigureAwait(false);
            return;
        }

        var now = time.GetUtcNow();
        var updated = await context.Set<MaintenanceCursor>()
            .Where(row => row.JobName == jobName)
            .ExecuteUpdateAsync(
                calls => calls
                    .SetProperty(row => row.Position, cursor)
                    .SetProperty(row => row.UpdatedAtUtc, now),
                cancellationToken)
            .ConfigureAwait(false);
        if (updated == 0)
        {
            context.Set<MaintenanceCursor>().Add(MaintenanceCursor.Keep(jobName, cursor, now));
            await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    /// <inheritdoc />
    public async Task ClearAsync(string jobName, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(jobName);

        await context.Set<MaintenanceCursor>()
            .Where(row => row.JobName == jobName)
            .ExecuteDeleteAsync(cancellationToken)
            .ConfigureAwait(false);
    }
}
