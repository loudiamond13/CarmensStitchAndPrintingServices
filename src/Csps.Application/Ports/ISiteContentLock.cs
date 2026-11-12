namespace Csps.Application.Ports;

/// <summary>
/// The one lock that serializes changes that depend on the whole site-content list, such as adding a closure that must not overlap
/// another (CONT-04). It is held until the surrounding transaction ends, so a second writer waits for the first to commit and then
/// reads what is really stored.
/// </summary>
public interface ISiteContentLock
{
    /// <summary>
    /// Takes the lock for the current transaction. Call it first inside <see cref="IUnitOfWork.InTransactionAsync{T}"/>, before
    /// anything the decision depends on is read. Waits at most 10 seconds.
    /// </summary>
    /// <param name="cancellationToken">Cancels the wait.</param>
    /// <returns>A task that completes when the lock is held.</returns>
    /// <exception cref="SiteContentBusyException">The lock could not be had in time.</exception>
    /// <exception cref="InvalidOperationException">The standing lock row is missing; this is a setup fault and is never answered as busy.</exception>
    Task TakeAsync(CancellationToken cancellationToken);
}
