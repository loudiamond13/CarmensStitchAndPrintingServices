using Csps.Domain.Orders;

namespace Csps.Application.Ports;

/// <summary>The tracked store of orders: new orders are added and found for change, and saved by <see cref="IUnitOfWork"/>.</summary>
public interface IOrders
{
    /// <summary>Adds a new order, with its items and history, to the unit of work. Nothing is saved here.</summary>
    /// <param name="order">The new order.</param>
    void Add(Order order);

    /// <summary>
    /// Removes an order found by <see cref="FindAsync"/> in the unit of work, so the delete and the audit entry share one save. The
    /// loaded children go with it and the database removes the rest, including the status history. Nothing is saved here.
    /// </summary>
    /// <param name="order">The tracked order.</param>
    void Remove(Order order);

    /// <summary>Tells whether an order, deleted ones included, already holds a number. The unique number index is the backstop when two saves race.</summary>
    /// <param name="number">The order number.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>True when an order holds the number.</returns>
    Task<bool> NumberTakenAsync(string number, CancellationToken cancellationToken);

    /// <summary>Finds one order for change, tracked, with its items. The status history is not loaded.</summary>
    /// <param name="id">The order id.</param>
    /// <param name="includeDeleted">True to also find a soft-deleted order (restore and permanent delete).</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The order, or null when none matches.</returns>
    Task<Order?> FindAsync(Guid id, bool includeDeleted, CancellationToken cancellationToken);

    /// <summary>
    /// Takes the write lock on the order's row, kept to the end of the transaction, before any of its children are written. A
    /// child write that inserts or deletes a row first and updates the order second can wait on a reader that waits on it, and
    /// SQL Server kills one of them; taking the order's row first makes the second writer wait here, where it holds nothing, and
    /// lose cleanly. Call it only when there is a change to save: it moves the order's row version.
    /// </summary>
    /// <param name="order">The tracked order, as found by <see cref="FindAsync"/>.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes once the lock is held and the order carries the new row version.</returns>
    /// <exception cref="Csps.Application.Common.ConcurrencyConflictException">Another request changed the order after it was found; the tracked state has been dropped.</exception>
    Task LockAsync(Order order, CancellationToken cancellationToken);
}
