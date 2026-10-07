namespace Csps.Domain.Content;

/// <summary>
/// The site-wide settings aggregate (FND-09). There is exactly one row, <see cref="SingletonId"/>; the
/// database enforces this with a CHECK constraint. Money is never formatted here: the API returns numbers
/// plus <see cref="CurrencyCode"/> and <see cref="Locale"/>, and the client formats them.
/// </summary>
public sealed class SiteSettings
{
    /// <summary>The only valid primary key.</summary>
    public const int SingletonId = 1;

    /// <summary>Maximum length of <see cref="BusinessName"/> in UTF-16 code units.</summary>
    public const int BusinessNameMaxLength = 120;

    /// <summary>Maximum length of <see cref="TimeZoneId"/> in UTF-16 code units.</summary>
    public const int TimeZoneIdMaxLength = 64;

    /// <summary>Length of <see cref="CurrencyCode"/> (ISO 4217).</summary>
    public const int CurrencyCodeMaxLength = 3;

    /// <summary>Maximum length of <see cref="Locale"/> in UTF-16 code units.</summary>
    public const int LocaleMaxLength = 16;

    /// <summary>Maximum length of <see cref="ContactEmail"/> in UTF-16 code units (RFC 5321 path limit).</summary>
    public const int ContactEmailMaxLength = 254;

    /// <summary>Maximum length of <see cref="ContactPhone"/> in UTF-16 code units.</summary>
    public const int ContactPhoneMaxLength = 32;

    /// <summary>Maximum length of <see cref="AddressLine"/> in UTF-16 code units.</summary>
    public const int AddressLineMaxLength = 200;

    /// <summary>Maximum length of <see cref="FacebookUrl"/> in UTF-16 code units.</summary>
    public const int FacebookUrlMaxLength = 300;

    // Used by EF Core (constructor binding) and by CreateDefault.
    private SiteSettings(
        int id,
        string businessName,
        string timeZoneId,
        string currencyCode,
        string locale,
        string contactEmail,
        string contactPhone,
        string addressLine,
        string facebookUrl,
        DateTimeOffset createdAtUtc,
        Guid? createdByUserId,
        DateTimeOffset? updatedAtUtc,
        Guid? updatedByUserId,
        byte[] rowVersion)
    {
        Id = id;
        BusinessName = businessName;
        TimeZoneId = timeZoneId;
        CurrencyCode = currencyCode;
        Locale = locale;
        ContactEmail = contactEmail;
        ContactPhone = contactPhone;
        AddressLine = addressLine;
        FacebookUrl = facebookUrl;
        CreatedAtUtc = createdAtUtc;
        CreatedByUserId = createdByUserId;
        UpdatedAtUtc = updatedAtUtc;
        UpdatedByUserId = updatedByUserId;
        RowVersion = rowVersion;
    }

    /// <summary>Primary key; always <see cref="SingletonId"/>.</summary>
    public int Id { get; private set; }

    /// <summary>The business name shown on the site.</summary>
    public string BusinessName { get; private set; }

    /// <summary>The business time zone id (IANA or Windows), resolved through <c>TimeZoneResolver</c>.</summary>
    public string TimeZoneId { get; private set; }

    /// <summary>ISO 4217 currency code.</summary>
    public string CurrencyCode { get; private set; }

    /// <summary>Formatting locale, for example <c>en-PH</c>.</summary>
    public string Locale { get; private set; }

    /// <summary>Public contact email.</summary>
    public string ContactEmail { get; private set; }

    /// <summary>Public contact phone.</summary>
    public string ContactPhone { get; private set; }

    /// <summary>Public shop address.</summary>
    public string AddressLine { get; private set; }

    /// <summary>Public Facebook page URL.</summary>
    public string FacebookUrl { get; private set; }

    /// <summary>When the row was created (UTC).</summary>
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <summary>Who created the row; null for the migration seed.</summary>
    public Guid? CreatedByUserId { get; private set; }

    /// <summary>When the row was last updated (UTC); null until the first edit.</summary>
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    /// <summary>Who last updated the row; null until the first edit.</summary>
    public Guid? UpdatedByUserId { get; private set; }

    /// <summary>Optimistic-concurrency token maintained by the database (409 on conflict).</summary>
    public byte[] RowVersion { get; private set; }

    /// <summary>
    /// Creates the singleton with the <see cref="SiteSettingsDefaults"/> values. Used by the dev seed when the
    /// row is missing; production gets the row from the migration.
    /// </summary>
    /// <param name="createdAtUtc">The creation instant, read from the caller's <c>TimeProvider</c>.</param>
    /// <returns>A new, unsaved settings aggregate.</returns>
    public static SiteSettings CreateDefault(DateTimeOffset createdAtUtc) =>
        new(
            SingletonId,
            SiteSettingsDefaults.BusinessName,
            SiteSettingsDefaults.TimeZoneId,
            SiteSettingsDefaults.CurrencyCode,
            SiteSettingsDefaults.Locale,
            SiteSettingsDefaults.ContactEmail,
            SiteSettingsDefaults.ContactPhone,
            SiteSettingsDefaults.AddressLine,
            SiteSettingsDefaults.FacebookUrl,
            createdAtUtc,
            createdByUserId: null,
            updatedAtUtc: null,
            updatedByUserId: null,
            rowVersion: []);

    /// <summary>
    /// Puts every <see cref="SiteSettingsDefaults"/> value back (business name, zone, currency, locale and the
    /// four contact placeholders, D-04). Used only by the dev seed.
    /// </summary>
    /// <param name="utcNow">The current instant, read from the caller's <c>TimeProvider</c>.</param>
    /// <returns>True when at least one value differed and was reset; false when nothing changed.</returns>
    public bool ResetToSeedDefaults(DateTimeOffset utcNow)
    {
        // Ordinal: the seed values must round-trip byte-exact, so a case-only difference is a difference.
        var differs =
            !string.Equals(BusinessName, SiteSettingsDefaults.BusinessName, StringComparison.Ordinal)
            || !string.Equals(TimeZoneId, SiteSettingsDefaults.TimeZoneId, StringComparison.Ordinal)
            || !string.Equals(CurrencyCode, SiteSettingsDefaults.CurrencyCode, StringComparison.Ordinal)
            || !string.Equals(Locale, SiteSettingsDefaults.Locale, StringComparison.Ordinal)
            || !string.Equals(ContactEmail, SiteSettingsDefaults.ContactEmail, StringComparison.Ordinal)
            || !string.Equals(ContactPhone, SiteSettingsDefaults.ContactPhone, StringComparison.Ordinal)
            || !string.Equals(AddressLine, SiteSettingsDefaults.AddressLine, StringComparison.Ordinal)
            || !string.Equals(FacebookUrl, SiteSettingsDefaults.FacebookUrl, StringComparison.Ordinal);

        if (!differs)
        {
            return false;
        }

        BusinessName = SiteSettingsDefaults.BusinessName;
        TimeZoneId = SiteSettingsDefaults.TimeZoneId;
        CurrencyCode = SiteSettingsDefaults.CurrencyCode;
        Locale = SiteSettingsDefaults.Locale;
        ContactEmail = SiteSettingsDefaults.ContactEmail;
        ContactPhone = SiteSettingsDefaults.ContactPhone;
        AddressLine = SiteSettingsDefaults.AddressLine;
        FacebookUrl = SiteSettingsDefaults.FacebookUrl;
        UpdatedAtUtc = utcNow;
        UpdatedByUserId = null;
        return true;
    }
}
