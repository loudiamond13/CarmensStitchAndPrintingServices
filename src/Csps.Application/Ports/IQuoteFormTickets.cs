namespace Csps.Application.Ports;

/// <summary>
/// The signed ticket a visitor gets before the quote form can be sent (INQ-03, D-25). It holds the time it was issued, so the
/// server, not the browser, knows how old the ticket is. It is not single use and is not tied to a visitor: it can be used for any
/// number of sends until it expires, so the minimum time only stops a bot that sends at once and the rate limits are the real
/// guard (D-40).
/// </summary>
public interface IQuoteFormTickets
{
    /// <summary>Makes a ticket that holds the given time.</summary>
    /// <param name="now">The time the ticket is issued.</param>
    /// <returns>The ticket text.</returns>
    string Issue(DateTimeOffset now);

    /// <summary>Reads a ticket.</summary>
    /// <param name="ticket">The ticket text from the form; may be missing.</param>
    /// <param name="now">The current time.</param>
    /// <returns>The age of a good ticket, or an expired reading for a missing, changed, unreadable or old one.</returns>
    QuoteTicketReading Read(string? ticket, DateTimeOffset now);
}

/// <summary>What reading a form ticket found.</summary>
/// <param name="IsValid">True when the ticket is ours, is not changed and is not older than its lifetime.</param>
/// <param name="Age">How long ago the ticket was issued; zero when it is not valid or the clock moved back.</param>
public readonly record struct QuoteTicketReading(bool IsValid, TimeSpan Age)
{
    /// <summary>Gets the reading of a ticket that cannot be used.</summary>
    public static QuoteTicketReading Expired { get; } = new(false, TimeSpan.Zero);

    /// <summary>Makes the reading of a good ticket.</summary>
    /// <param name="age">How long ago it was issued.</param>
    /// <returns>The reading.</returns>
    public static QuoteTicketReading Valid(TimeSpan age) => new(true, age < TimeSpan.Zero ? TimeSpan.Zero : age);
}
