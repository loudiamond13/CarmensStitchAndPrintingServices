using Csps.Application.Money;

namespace Csps.Application.Ports;

/// <summary>
/// Thrown when the site-content lock could not be had in time. The closure handlers answer it with the shared 409 "Something changed
/// at the same time. Try again." line. It is an <see cref="InvalidOperationException"/>, so a caller that does not expect it still fails loudly.
/// </summary>
public sealed class SiteContentBusyException : InvalidOperationException
{
    /// <summary>Initializes a new instance of the <see cref="SiteContentBusyException"/> class.</summary>
    public SiteContentBusyException()
        : base(MoneyErrors.BusyMessage)
    {
    }

    /// <summary>Initializes a new instance of the <see cref="SiteContentBusyException"/> class with the error that caused it.</summary>
    /// <param name="inner">The lock timeout that caused it.</param>
    public SiteContentBusyException(Exception? inner)
        : base(MoneyErrors.BusyMessage, inner)
    {
    }
}
