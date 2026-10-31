namespace Csps.Application.Ports;

/// <summary>
/// Thrown when a save fails because a row still uses the order list entry being deleted: the foreign key from the order items,
/// payments or order expenses found it first, as when an order uses the entry in the same moment the delete is decided. It is an
/// <see cref="InvalidOperationException"/>, so a caller that does not expect it still fails loudly.
/// </summary>
public sealed class OrderListEntryInUseException()
    : InvalidOperationException("This entry is used by an order, so it can't be deleted.");
