namespace Csps.Application.OrderLists;

/// <summary>
/// The add and edit forms of an order list entry (D-19, SEC-07). Any other member in the body is ignored: who added or changed the
/// entry and when come from the token and the clock (SEC-08).
/// </summary>
/// <param name="Name">The name; required after trimming, at most 40 characters, unique in its list ignoring letter case. The order expense Others keeps its name.</param>
/// <param name="Tone">One of <c>neutral</c>, <c>accent</c>, <c>info</c>, <c>mockup</c>, <c>warning</c>, <c>success</c>.</param>
/// <param name="Version">The base64 of the eight-byte row version the edit form was opened with; required when editing, ignored when adding.</param>
public sealed record OrderListEntryRequest(string? Name, string? Tone, string? Version)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static OrderListEntryRequest Empty { get; } = new(null, null, null);
}
