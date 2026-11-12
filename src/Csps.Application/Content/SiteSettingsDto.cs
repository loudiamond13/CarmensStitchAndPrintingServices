using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>One phone number as the Business Info form shows it.</summary>
/// <param name="Number">The number as people read it, such as "0917 123 4567"; the form sends the same text back.</param>
/// <param name="Label">An optional label such as "Globe"; null when not set.</param>
/// <param name="IsMain">True for the number the Call buttons dial.</param>
public sealed record SitePhoneDto(string Number, string? Label, bool IsMain);

/// <summary>
/// The staff view of the site settings (D-29, CONT-01): every Business Info field, the shop email, the phones, the version a save must
/// send back and who last changed the settings. The time zone, currency and locale are fixed and only shown (D-35). A value that is
/// not set is null.
/// </summary>
/// <param name="BusinessName">The business name.</param>
/// <param name="Tagline">The tagline.</param>
/// <param name="AboutText">The about text.</param>
/// <param name="TurnaroundLine">The turnaround line.</param>
/// <param name="Street">Street and barangay.</param>
/// <param name="TownOrCity">Town or city.</param>
/// <param name="Province">Province.</param>
/// <param name="PostalCode">Postal code.</param>
/// <param name="DirectionsUrl">The directions link.</param>
/// <param name="MapEmbedUrl">The map embed link.</param>
/// <param name="MessengerUrl">The Messenger link.</param>
/// <param name="FacebookUrl">The Facebook page link.</param>
/// <param name="InstagramUrl">The Instagram link.</param>
/// <param name="TiktokUrl">The TikTok link.</param>
/// <param name="ContactEmail">The shop email, for staff use only.</param>
/// <param name="Phones">The phone numbers, the main one first.</param>
/// <param name="TimeZoneId">The business time zone id; read-only.</param>
/// <param name="CurrencyCode">ISO 4217 currency code; read-only.</param>
/// <param name="Locale">Formatting locale; read-only.</param>
/// <param name="Version">The base64 of the eight-byte row version a save must send back (409 on a stale one).</param>
/// <param name="UpdatedByName">The name of the person who last changed the settings; null when no person did.</param>
/// <param name="UpdatedAtUtc">When the settings were last changed; null until a change.</param>
public sealed record SiteSettingsDto(
    string BusinessName,
    string Tagline,
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
    IReadOnlyList<SitePhoneDto> Phones,
    string TimeZoneId,
    string CurrencyCode,
    string Locale,
    string Version,
    string? UpdatedByName,
    DateTimeOffset? UpdatedAtUtc)
{
    /// <summary>Maps a settings view to the DTO (manual mapping, PRD section 3.3).</summary>
    /// <param name="view">The view.</param>
    /// <returns>The DTO.</returns>
    public static SiteSettingsDto From(SiteSettingsView view)
    {
        ArgumentNullException.ThrowIfNull(view);

        return new SiteSettingsDto(
            view.BusinessName,
            view.Tagline,
            view.AboutText,
            view.TurnaroundLine,
            view.Street,
            view.TownOrCity,
            view.Province,
            view.PostalCode,
            view.DirectionsUrl,
            view.MapEmbedUrl,
            view.MessengerUrl,
            NullWhenEmpty(view.FacebookUrl),
            view.InstagramUrl,
            view.TikTokUrl,
            NullWhenEmpty(view.ContactEmail),
            [.. view.Phones.Select(static phone => new SitePhoneDto(DisplayOf(phone.E164), phone.Label, phone.IsMain))],
            view.TimeZoneId,
            view.CurrencyCode,
            view.Locale,
            RowVersions.ToText(view.RowVersion),
            view.UpdatedByName,
            view.UpdatedAtUtc);
    }

    // The Facebook and email columns are required, so "not set" is stored as an empty string.
    private static string? NullWhenEmpty(string value) => value.Length == 0 ? null : value;

    private static string DisplayOf(string number) => PhilippinePhone.TryParse(number, out var phone) ? phone.Display : number;
}
