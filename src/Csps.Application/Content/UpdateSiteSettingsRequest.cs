namespace Csps.Application.Content;

/// <summary>One phone number of the Business Info form.</summary>
/// <param name="Number">The number as typed; a Philippine mobile or landline number.</param>
/// <param name="Label">An optional label, at most 20 characters.</param>
/// <param name="IsMain">True for the number the Call buttons dial; exactly one number is the main one.</param>
public sealed record PhoneEntry(string? Number, string? Label, bool IsMain);

/// <summary>
/// The Business Info form (CONT-01, SEC-07). An empty optional value clears it. Any other member in the body is ignored: who changed
/// the settings and when come from the token and the clock (SEC-08).
/// </summary>
/// <param name="Version">The base64 of the eight-byte row version the form was opened with; required.</param>
/// <param name="BusinessName">The business name; required, at most 100 characters.</param>
/// <param name="Tagline">The tagline; required, at most 160 characters.</param>
/// <param name="AboutText">The about text; at most 600 characters.</param>
/// <param name="TurnaroundLine">The turnaround line; at most 120 characters.</param>
/// <param name="Street">Street and barangay; required, at most 120 characters.</param>
/// <param name="TownOrCity">Town or city; required, at most 60 characters.</param>
/// <param name="Province">Province; required, at most 60 characters.</param>
/// <param name="PostalCode">The 4-digit postal code.</param>
/// <param name="DirectionsUrl">A Google Maps link.</param>
/// <param name="MapEmbedUrl">A <c>https://www.google.com/maps/embed?</c> link.</param>
/// <param name="MessengerUrl">A <c>https://m.me/</c> link.</param>
/// <param name="FacebookUrl">A Facebook page link.</param>
/// <param name="InstagramUrl">An Instagram link.</param>
/// <param name="TiktokUrl">A TikTok link.</param>
/// <param name="ContactEmail">The shop email, for staff use only; at most 254 characters.</param>
/// <param name="Phones">One to four numbers, exactly one of them the main one.</param>
public sealed record UpdateSiteSettingsRequest(
    string? Version,
    string? BusinessName,
    string? Tagline,
    string? AboutText,
    string? TurnaroundLine,
    string? Street,
    string? TownOrCity,
    string? Province,
    string? PostalCode,
    string? DirectionsUrl,
    string? MapEmbedUrl,
    string? MessengerUrl,
    string? FacebookUrl,
    string? InstagramUrl,
    string? TiktokUrl,
    string? ContactEmail,
    IReadOnlyList<PhoneEntry>? Phones)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static UpdateSiteSettingsRequest Empty { get; } = new(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
}
