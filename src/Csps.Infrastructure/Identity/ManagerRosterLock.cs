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
    public Task LockActiveManagersAsync(CancellationToken cancellationToken) =>
        DatabaseLocks.TakeAsync(
            context,
            DatabaseLocks.ActiveManagers,
            time.GetUtcNow(),
            DatabaseLocks.DefaultWait,
            "The Manager roster lock could not be taken.",
            cancellationToken);
}
