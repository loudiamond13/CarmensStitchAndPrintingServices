namespace Csps.Application.Ports;

/// <summary>
/// The one lock that serializes every change that could remove an active Manager (D-18, T-05-60). It is held until the surrounding
/// transaction ends, so a second request waits for the first to commit and then counts the Managers that are really left.
/// </summary>
public interface IManagerRosterLock
{
    /// <summary>
    /// Takes the lock for the current transaction. Call it first inside <see cref="IUnitOfWork.InTransactionAsync{T}"/>, before the target is
    /// read and before active Managers are counted. Waits at most 10 seconds.
    /// </summary>
    /// <param name="cancellationToken">Cancels the wait.</param>
    /// <returns>A task that completes when the lock is held.</returns>
    /// <exception cref="InvalidOperationException">The lock could not be taken (timeout, deadlock or error).</exception>
    Task LockActiveManagersAsync(CancellationToken cancellationToken);
}
