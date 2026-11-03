using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Maintenance;

/// <summary>
/// The maintenance run lease as a claim row in DatabaseLocks (JOB-01, T-09-17). The row is committed on its own context, so a second
/// run sees it at once. A run cut off by an app pool recycle leaves the row; it stops counting after <see cref="Lease"/> and the next
/// run clears it.
/// </summary>
/// <param name="contexts">Makes the short-lived contexts that write and free the claim on their own.</param>
internal sealed class MaintenanceRunLock(IDbContextFactory<CspsDbContext> contexts) : IMaintenanceRunLock
{
    /// <summary>The name of the claim row.</summary>
    internal const string LockName = "maintenance-run";

    /// <summary>How long the lease counts when its run never gives it back.</summary>
    internal static readonly TimeSpan Lease = TimeSpan.FromMinutes(3);

    private const int DuplicateIndexKey = 2601;
    private const int DuplicateKey = 2627;

    /// <inheritdoc />
    public async Task<bool> TryTakeAsync(Guid holder, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (await TryInsertAsync(holder, now, cancellationToken).ConfigureAwait(false))
        {
            return true;
        }

        var cleared = await contexts.CreateDbContextAsync(cancellationToken).ConfigureAwait(false);
        await using (cleared.ConfigureAwait(false))
        {
            await cleared.Set<DatabaseLock>()
                .Where(claim => claim.Name == LockName && claim.ExpiresAtUtc != null && claim.ExpiresAtUtc <= now)
                .ExecuteDeleteAsync(cancellationToken)
                .ConfigureAwait(false);
        }

        return await TryInsertAsync(holder, now, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task ReleaseAsync(Guid holder, CancellationToken cancellationToken)
    {
        var release = await contexts.CreateDbContextAsync(cancellationToken).ConfigureAwait(false);
        await using (release.ConfigureAwait(false))
        {
            await release.Set<DatabaseLock>()
                .Where(claim => claim.Name == LockName && claim.HolderId == holder)
                .ExecuteDeleteAsync(cancellationToken)
                .ConfigureAwait(false);
        }
    }

    private async Task<bool> TryInsertAsync(Guid holder, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var claimContext = await contexts.CreateDbContextAsync(cancellationToken).ConfigureAwait(false);
        await using (claimContext.ConfigureAwait(false))
        {
            claimContext.Add(DatabaseLock.Claim(LockName, holder, now, Lease));
            try
            {
                await claimContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                return true;
            }
            catch (DbUpdateException error) when (error.InnerException is SqlException { Number: DuplicateIndexKey or DuplicateKey })
            {
                return false;
            }
        }
    }
}
