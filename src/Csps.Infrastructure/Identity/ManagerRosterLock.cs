using System.Data;
using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Identity;

/// <summary><see cref="IManagerRosterLock"/> over the request's scoped <see cref="CspsDbContext"/>.</summary>
/// <param name="context">The scoped database context.</param>
internal sealed class ManagerRosterLock(CspsDbContext context) : IManagerRosterLock
{
    private const string Resource = "csps-active-managers";

    // Same shape as AccountTokenStore.LockAccountAsync: a transaction-owned application lock, so no trigger is needed (OR-7).
    public async Task LockActiveManagersAsync(CancellationToken cancellationToken)
    {
        var outcome = new SqlParameter("@result", SqlDbType.Int) { Direction = ParameterDirection.Output };
        await context.Database.ExecuteSqlRawAsync(
            "EXEC @result = sp_getapplock @Resource = {0}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000",
            [Resource, outcome],
            cancellationToken).ConfigureAwait(false);

        // 0 and 1 mean the lock is held; a negative value is a timeout, a deadlock or an error.
        if (outcome.Value is not int code || code < 0)
        {
            throw new InvalidOperationException("The Manager roster lock could not be taken.");
        }
    }
}
