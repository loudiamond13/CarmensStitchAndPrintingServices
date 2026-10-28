using Csps.Domain.Orders;

namespace Csps.Application.Ports;

/// <summary>The tracked store of orders: new orders are added and found for change, and saved by <see cref="IUnitOfWork"/>.</summary>
public interface IOrders
{
    /// <summary>Adds a new order, with its items and history, to the unit of work. Nothing is saved here.</summary>
    /// <param name="order">The new order.</param>
    void Add(Order order);

    /// <summary>Finds one order for change, tracked, with its items. The status history is not loaded.</summary>
    /// <param name="id">The order id.</param>
    /// <param name="includeDeleted">True to also find a soft-deleted order (restore and permanent delete).</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The order, or null when none matches.</returns>
    Task<Order?> FindAsync(Guid id, bool includeDeleted, CancellationToken cancellationToken);
}
