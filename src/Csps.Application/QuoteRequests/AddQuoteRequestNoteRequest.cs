namespace Csps.Application.QuoteRequests;

/// <summary>
/// The Add Note action on a quote request (D-17). Any other member in the body, such as a forged <c>createdById</c>, is ignored: who
/// wrote the note and when come from the token and the clock (SEC-08).
/// </summary>
/// <param name="Text">The note, 1 to 1,000 characters after trimming.</param>
public sealed record AddQuoteRequestNoteRequest(string? Text)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports the text.</summary>
    public static AddQuoteRequestNoteRequest Empty { get; } = new((string?)null);
}
