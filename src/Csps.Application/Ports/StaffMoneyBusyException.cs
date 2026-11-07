using Csps.Application.Money;

namespace Csps.Application.Ports;

/// <summary>
/// Thrown when the staff money lock could not be had in time, or the wait deadlocked. The transfer handlers answer it with the 409
/// <c>money-transfers.busy</c> error. It is an <see cref="InvalidOperationException"/>, so a caller that does not expect it still fails loudly.
/// </summary>
public sealed class StaffMoneyBusyException()
    : InvalidOperationException(MoneyErrors.BusyMessage);
