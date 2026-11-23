namespace Csps.Application.QuoteRequests;

/// <summary>
/// The Change Status action on a quote request (D-15). Any other member in the body, such as a forged <c>updatedById</c>, is ignored:
/// who moved the request and when come from the token and the clock (SEC-08).
/// </summary>
/// <param name="Status">The status key: new, contacted, quoted, closed or spam. Converted is set only by turning the request into an order.</param>
/// <param name="Version">The base64 of the eight-byte row version the page was opened with.</param>
public sealed record ChangeQuoteRequestStatusRequest(string? Status, string? Version)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports both fields.</summary>
    public static ChangeQuoteRequestStatusRequest Empty { get; } = new(null, null);
}
