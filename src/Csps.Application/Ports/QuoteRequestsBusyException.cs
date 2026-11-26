using Csps.Application.Money;

namespace Csps.Application.Ports;

/// <summary>
/// Thrown when the quote request lock could not be had in time. The create handler answers it with the shared 409 "Something changed
/// at the same time. Try again." line. It is an <see cref="InvalidOperationException"/>, so a caller that does not expect it still fails loudly.
/// </summary>
public sealed class QuoteRequestsBusyException : InvalidOperationException
{
    /// <summary>Initializes a new instance of the <see cref="QuoteRequestsBusyException"/> class.</summary>
    public QuoteRequestsBusyException()
        : base(MoneyErrors.BusyMessage)
    {
    }

    /// <summary>Initializes a new instance of the <see cref="QuoteRequestsBusyException"/> class with the error that caused it.</summary>
    /// <param name="inner">The lock timeout that caused it.</param>
    public QuoteRequestsBusyException(Exception? inner)
        : base(MoneyErrors.BusyMessage, inner)
    {
    }
}
