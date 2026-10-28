using Csps.Application.Orders;

namespace Csps.Application.Ports;

/// <summary>Untracked reads of orders: one order with its items, history and people, shaped for the wire.</summary>
public interface IOrderReader
{
    /// <summary>Reads one order that is not deleted.</summary>
    /// <param name="id">The order id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The order, or null when none exists or it was deleted.</returns>
    Task<OrderDetailResponse?> GetDetailAsync(Guid id, CancellationToken cancellationToken);
}
