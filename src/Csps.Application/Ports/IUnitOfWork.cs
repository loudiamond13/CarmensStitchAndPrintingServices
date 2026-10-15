namespace Csps.Application.Ports;

/// <summary>
/// The single way a handler commits (D-24 write path): saves the request's tracked changes, including audit entries
/// added with <see cref="IAuditTrail.Record"/>, in one unit.
/// </summary>
public interface IUnitOfWork
{
    /// <summary>Saves every tracked change of the current request.</summary>
    /// <param name="cancellationToken">Cancels the save.</param>
    /// <returns>The number of rows written.</returns>
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Runs <paramref name="work"/> in one transaction: commits when it returns, rolls everything back (audit entries
    /// included) when it throws. Joins a transaction already open on the request's context instead of starting a second.
    /// </summary>
    /// <typeparam name="T">The result type of the work.</typeparam>
    /// <param name="work">The work to run; it calls <see cref="SaveChangesAsync"/> itself.</param>
    /// <param name="cancellationToken">Cancels the transaction.</param>
    /// <returns>The result of <paramref name="work"/>.</returns>
    Task<T> InTransactionAsync<T>(Func<CancellationToken, Task<T>> work, CancellationToken cancellationToken);
}
