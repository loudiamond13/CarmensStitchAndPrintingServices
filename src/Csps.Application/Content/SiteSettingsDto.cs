namespace Csps.Application.Content;

/// <summary>The site settings as the API returns them (D-29). Read-only for now; editing comes later.</summary>
/// <param name="BusinessName">The business name shown on the site.</param>
/// <param name="TimeZoneId">The business time zone id.</param>
/// <param name="CurrencyCode">ISO 4217 currency code.</param>
/// <param name="Locale">Formatting locale.</param>
/// <param name="ContactEmail">Public contact email.</param>
/// <param name="ContactPhone">Public contact phone.</param>
/// <param name="AddressLine">Public shop address.</param>
/// <param name="FacebookUrl">Public Facebook page URL.</param>
/// <param name="RowVersion">Base64 concurrency token, echoed back by a future edit (409 on conflict).</param>
public sealed record SiteSettingsDto(
    string BusinessName,
    string TimeZoneId,
    string CurrencyCode,
    string Locale,
    string ContactEmail,
    string ContactPhone,
    string AddressLine,
    string FacebookUrl,
    string RowVersion)
{
    /// <summary>Maps a settings snapshot to the DTO (manual mapping, PRD section 3.3).</summary>
    /// <param name="snapshot">The snapshot.</param>
    /// <returns>The DTO.</returns>
    public static SiteSettingsDto From(SiteSettingsSnapshot snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);

        return new SiteSettingsDto(
            snapshot.BusinessName,
            snapshot.TimeZoneId,
            snapshot.CurrencyCode,
            snapshot.Locale,
            snapshot.ContactEmail,
            snapshot.ContactPhone,
            snapshot.AddressLine,
            snapshot.FacebookUrl,
            snapshot.RowVersion);
    }
}
