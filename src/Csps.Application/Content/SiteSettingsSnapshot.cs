using System.ComponentModel;

namespace Csps.Application.Content;

/// <summary>
/// Read-only view of the SiteSettings singleton (FND-09). Sealed and marked immutable so the cache can hand
/// out the same instance instead of copying it on every read.
/// </summary>
/// <param name="BusinessName">The business name shown on the site.</param>
/// <param name="TimeZoneId">The stored business time zone id; resolve it with <c>TimeZoneResolver</c>.</param>
/// <param name="CurrencyCode">ISO 4217 currency code (PHP).</param>
/// <param name="Locale">Formatting locale (en-PH). Clients format money; the API returns numbers.</param>
/// <param name="ContactEmail">Public contact email.</param>
/// <param name="ContactPhone">Public contact phone.</param>
/// <param name="AddressLine">Public shop address.</param>
/// <param name="FacebookUrl">Public Facebook page URL.</param>
/// <param name="RowVersion">Base64 concurrency token, echoed back by a future edit (409 on conflict).</param>
[ImmutableObject(true)]
public sealed record SiteSettingsSnapshot(
    string BusinessName,
    string TimeZoneId,
    string CurrencyCode,
    string Locale,
    string ContactEmail,
    string ContactPhone,
    string AddressLine,
    string FacebookUrl,
    string RowVersion);
