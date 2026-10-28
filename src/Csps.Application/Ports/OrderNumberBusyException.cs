using Csps.Application.Orders;

namespace Csps.Application.Ports;

/// <summary>
/// Thrown when the order number lock could not be had in time, or the wait deadlocked. The create handler answers it with the
/// 409 <c>orders.busy</c> error. It is an <see cref="InvalidOperationException"/>, so a caller that does not expect it still fails loudly.
/// </summary>
public sealed class OrderNumberBusyException()
    : InvalidOperationException(OrderErrors.BusyMessage);
