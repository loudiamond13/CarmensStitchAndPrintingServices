namespace Csps.Application.Ports;

/// <summary>
/// The one lock that serializes every transfer and hand-over (MONEY-05, D-53). It is held until the surrounding transaction ends, so a
/// second transfer waits for the first to commit and then reads the balances that are really left.
/// </summary>
public interface IStaffMoneyLock
{
    /// <summary>
    /// Takes the lock for the current transaction. Call it first inside <see cref="IUnitOfWork.InTransactionAsync{T}"/>, before any
    /// person or balance is read. Waits at most 10 seconds.
    /// </summary>
    /// <param name="cancellationToken">Cancels the wait.</param>
    /// <returns>A task that completes when the lock is held.</returns>
    /// <exception cref="StaffMoneyBusyException">The lock could not be had in time, or the wait deadlocked.</exception>
    Task LockAsync(CancellationToken cancellationToken);
}
