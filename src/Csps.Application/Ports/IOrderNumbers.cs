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
}
