using Csps.Domain.Content;

namespace Csps.Application.Ports;

/// <summary>
/// Access to the business info a Manager edits (CONT-01): the settings row and the phone list. Application never sees EF: writes go
/// through tracked rows that the unit of work saves with their versions checked.
/// </summary>
public interface ISiteContentStore
{
    /// <summary>Loads the settings row and the phone rows as tracked rows, so a change to them is saved by the unit of work.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The settings and the phone rows in list order.</returns>
    /// <exception cref="InvalidOperationException">The singleton row is missing (the migrations were not applied).</exception>
    Task<SiteSettingsForUpdate> GetSettingsForUpdateAsync(CancellationToken cancellationToken);

    /// <summary>Marks the stored phone rows for removal and adds the new rows. The next save writes both.</summary>
    /// <param name="current">The tracked rows to remove.</param>
    /// <param name="replacement">The new rows.</param>
    void ReplacePhones(IReadOnlyList<SitePhoneNumber> current, IReadOnlyList<SitePhoneNumber> replacement);

    /// <summary>Reads everything the Business Info tab shows, straight from the database.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The settings, the phones, the version and who last changed them.</returns>
    /// <exception cref="InvalidOperationException">The singleton row is missing (the migrations were not applied).</exception>
    Task<SiteSettingsView> GetViewAsync(CancellationToken cancellationToken);
}

/// <summary>The tracked settings row and its tracked phone rows.</summary>
/// <param name="Settings">The settings singleton.</param>
/// <param name="Phones">The phone rows, main number first.</param>
public sealed record SiteSettingsForUpdate(SiteSettings Settings, IReadOnlyList<SitePhoneNumber> Phones);

/// <summary>One phone number as the read port returns it.</summary>
/// <param name="E164">The stored number, such as "+639171234567".</param>
/// <param name="Label">An optional label; null when not set.</param>
/// <param name="IsMain">True for the main number.</param>
public sealed record SitePhoneView(string E164, string? Label, bool IsMain);

/// <summary>The settings as the read port returns them.</summary>
/// <param name="BusinessName">The business name.</param>
/// <param name="Tagline">The tagline.</param>
/// <param name="AboutText">The about text; null when not set.</param>
/// <param name="TurnaroundLine">The turnaround line; null when not set.</param>
/// <param name="Street">The street; null when not set.</param>
/// <param name="TownOrCity">The town or city; null when not set.</param>
/// <param name="Province">The province; null when not set.</param>
/// <param name="PostalCode">The postal code; null when not set.</param>
/// <param name="DirectionsUrl">The directions link; null when not set.</param>
/// <param name="MapEmbedUrl">The map embed link; null when not set.</param>
/// <param name="MessengerUrl">The Messenger link; null when not set.</param>
/// <param name="FacebookUrl">The Facebook link; empty when not set.</param>
/// <param name="InstagramUrl">The Instagram link; null when not set.</param>
/// <param name="TikTokUrl">The TikTok link; null when not set.</param>
/// <param name="ContactEmail">The shop email; empty when not set.</param>
/// <param name="Phones">The phone rows, main number first.</param>
/// <param name="TimeZoneId">The business time zone id.</param>
/// <param name="CurrencyCode">The ISO 4217 currency code.</param>
/// <param name="Locale">The formatting locale.</param>
/// <param name="RowVersion">The eight-byte row version a save must send back.</param>
/// <param name="UpdatedByName">The name of the person who last changed the settings; null when no person did.</param>
/// <param name="UpdatedAtUtc">When the settings were last changed; null until a change.</param>
public sealed record SiteSettingsView(
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
    string FacebookUrl,
    string? InstagramUrl,
    string? TikTokUrl,
    string ContactEmail,
    IReadOnlyList<SitePhoneView> Phones,
    string TimeZoneId,
    string CurrencyCode,
    string Locale,
    byte[] RowVersion,
    string? UpdatedByName,
    DateTimeOffset? UpdatedAtUtc);
