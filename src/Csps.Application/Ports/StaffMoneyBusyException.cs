using Csps.Application.Money;

namespace Csps.Application.Ports;

/// <summary>
/// Thrown when the staff money lock could not be had in time, or the wait deadlocked. The transfer handlers answer it with the 409
/// <c>money-transfers.busy</c> error. It is an <see cref="InvalidOperationException"/>, so a caller that does not expect it still fails loudly.
/// </summary>
public sealed class StaffMoneyBusyException : InvalidOperationException
{
    /// <summary>Initializes a new instance of the <see cref="StaffMoneyBusyException"/> class.</summary>
    public StaffMoneyBusyException()
        : base(MoneyErrors.BusyMessage)
    {
    }

    /// <summary>Initializes a new instance of the <see cref="StaffMoneyBusyException"/> class with the error that caused it.</summary>
    /// <param name="inner">The lock timeout or deadlock that caused it.</param>
    public StaffMoneyBusyException(Exception? inner)
        : base(MoneyErrors.BusyMessage, inner)
    {
    }
}
