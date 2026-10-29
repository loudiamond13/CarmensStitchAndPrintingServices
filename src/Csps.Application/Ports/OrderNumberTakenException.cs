using Csps.Application.Orders;

namespace Csps.Application.Ports;

/// <summary>
/// Thrown when a save fails because another order already holds the number: the unique number index found it first, as when two
/// imports of one legacy number run at the same moment. The import handler answers it with the 422 <c>orders.number-taken</c> error.
/// It is an <see cref="InvalidOperationException"/>, so a caller that does not expect it still fails loudly. The number is never
/// put in the message.
/// </summary>
public sealed class OrderNumberTakenException()
    : InvalidOperationException(OrderErrors.NumberTakenMessage);
