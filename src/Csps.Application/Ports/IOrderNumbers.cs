namespace Csps.Application.Ports;

/// <summary>Gives out order numbers (ORD-14, D-23). It must be called inside the create transaction, after every check passed.</summary>
public interface IOrderNumbers
{
    /// <summary>
    /// Takes the order number lock, which is held to the end of the caller's transaction, and gives out the next number of a
    /// business year. The counter row saves with the order, so a rollback gives the number back.
    /// </summary>
    /// <param name="year">The business year of the save moment.</param>
    /// <param name="now">The current UTC time.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The number, for example <c>ORD-2026-0001</c>.</returns>
    /// <exception cref="OrderNumberBusyException">The lock was not had in time.</exception>
    Task<string> NextAsync(int year, DateTimeOffset now, CancellationToken cancellationToken);

    /// <summary>
    /// Takes the order number lock, held to the end of the caller's transaction, and keeps a legacy number from being given out
    /// again (ORD-14): when the number reads as <c>ORD-{YYYY}-{NNNN}</c>, that year's counter is lifted to at least NNNN. A number
    /// that does not read that way leaves every counter alone.
    /// </summary>
    /// <param name="number">The legacy order number.</param>
    /// <param name="now">The current UTC time.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes once the lock is held and the counter is lifted.</returns>
    /// <exception cref="OrderNumberBusyException">The lock was not had in time.</exception>
    Task ReserveLegacyAsync(string number, DateTimeOffset now, CancellationToken cancellationToken);
}
