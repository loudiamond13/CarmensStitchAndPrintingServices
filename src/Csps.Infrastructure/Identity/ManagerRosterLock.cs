using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;

namespace Csps.Infrastructure.Identity;

/// <summary><see cref="IManagerRosterLock"/> over the request's scoped <see cref="CspsDbContext"/>.</summary>
/// <param name="context">The scoped database context.</param>
/// <param name="time">The clock.</param>
internal sealed class ManagerRosterLock(CspsDbContext context, TimeProvider time) : IManagerRosterLock
{
    // A lock row, so no trigger (OR-7) and no inline SQL (D-50).
    public async Task LockActiveManagersAsync(CancellationToken cancellationToken)
    {
        try
        {
            await DatabaseLocks.TakeAsync(
                    context,
                    DatabaseLocks.ActiveManagers,
                    time.GetUtcNow(),
                    DatabaseLocks.DefaultWait,
                    "The Manager roster lock could not be taken.",
                    cancellationToken)
                .ConfigureAwait(false);
        }
        catch (DatabaseLockTimeoutException error) when (SqlErrors.Has(error, SqlErrors.DeadlockVictim))
        {
            // P10-BL-22: a lost deadlock is a lost race, as in StaffMoneyLock: the unit of work marks an outer transaction ended.
            context.ChangeTracker.Clear();
            throw new ConcurrencyConflictException(error);
        }
    }
}
