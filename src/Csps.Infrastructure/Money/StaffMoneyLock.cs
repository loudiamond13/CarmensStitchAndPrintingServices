using Csps.Application.Money;
using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;

namespace Csps.Infrastructure.Money;

/// <summary>
/// <see cref="IStaffMoneyLock"/> over the request's scoped <see cref="CspsDbContext"/> (MONEY-05, D-53). The lock is the update of the
/// standing <c>staff-money</c> row, so it needs no trigger (OR-7) and no inline SQL (D-50).
/// </summary>
/// <param name="context">The scoped database context.</param>
/// <param name="time">The clock.</param>
internal sealed class StaffMoneyLock(CspsDbContext context, TimeProvider time) : IStaffMoneyLock
{
    public async Task LockAsync(CancellationToken cancellationToken)
    {
        try
        {
            await DatabaseLocks.TakeAsync(
                    context,
                    DatabaseLocks.StaffMoney,
                    time.GetUtcNow(),
                    DatabaseLocks.DefaultWait,
                    MoneyErrors.BusyMessage,
                    cancellationToken)
                .ConfigureAwait(false);
        }
        catch (InvalidOperationException error) when (error.Message == MoneyErrors.BusyMessage)
        {
            throw new StaffMoneyBusyException();
        }
    }
}
