using Csps.Domain.OrderLists;

namespace Csps.Application.Ports;

/// <summary>
/// Thrown when a save fails because the order list entry an item, payment or order expense points at was deleted after the handler
/// checked it: the foreign key refused the insert or the update, as when a Manager deletes a never-used entry in the same moment
/// someone saves an order that uses it. The handler answers it as a refused choice. It is an <see cref="InvalidOperationException"/>,
/// so a caller that does not expect it still fails loudly.
/// </summary>
/// <param name="kind">Which list the deleted entry belonged to.</param>
public sealed class OrderListEntryDeletedException(OrderListKind kind)
    : InvalidOperationException("The list entry was deleted before the order was saved.")
{
    /// <summary>Gets which list the deleted entry belonged to.</summary>
    public OrderListKind Kind { get; } = kind;
}
