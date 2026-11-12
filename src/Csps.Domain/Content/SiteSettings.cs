using Csps.Domain.Common;

namespace Csps.Domain.Content;

/// <summary>
/// The site-wide settings aggregate (FND-09). There is exactly one row, <see cref="SingletonId"/>; the
/// database enforces this with a CHECK constraint. Money is never formatted here: the API returns numbers
/// plus <see cref="CurrencyCode"/> and <see cref="Locale"/>, and the client formats them. The public business
/// facts (tagline, address parts, links) live here too; phone numbers are <see cref="SitePhoneNumber"/> rows.
/// </summary>
public sealed class SiteSettings : IAttributedRecord, IPublicContentRecord
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

    /// <summary>Maximum length of <see cref="Tagline"/>.</summary>
    public const int TaglineMaxLength = 160;

    /// <summary>Maximum length of <see cref="AboutText"/>.</summary>
    public const int AboutTextMaxLength = 600;

    /// <summary>Maximum length of <see cref="TurnaroundLine"/>.</summary>
    public const int TurnaroundLineMaxLength = 120;

    /// <summary>Maximum length of <see cref="Street"/>.</summary>
    public const int StreetMaxLength = 120;

    /// <summary>Maximum length of <see cref="TownOrCity"/>.</summary>
    public const int TownOrCityMaxLength = 60;

    /// <summary>Maximum length of <see cref="Province"/>.</summary>
    public const int ProvinceMaxLength = 60;

    /// <summary>Maximum length of <see cref="PostalCode"/>.</summary>
    public const int PostalCodeMaxLength = 4;

    /// <summary>Maximum length of <see cref="DirectionsUrl"/>.</summary>
    public const int DirectionsUrlMaxLength = 300;

    /// <summary>Maximum length of <see cref="MapEmbedUrl"/>.</summary>
    public const int MapEmbedUrlMaxLength = 1000;

    /// <summary>Maximum length of <see cref="MessengerUrl"/>.</summary>
    public const int MessengerUrlMaxLength = 120;

    /// <summary>Maximum length of <see cref="InstagramUrl"/>.</summary>
    public const int InstagramUrlMaxLength = 300;

    /// <summary>Maximum length of <see cref="TikTokUrl"/>.</summary>
    public const int TikTokUrlMaxLength = 300;

    /// <summary>The machine code of business info that breaks field rules.</summary>
    public const string InvalidCode = "site-settings.invalid-request";

    /// <summary>The text above the field errors.</summary>
    public const string InvalidMessage = "Check the highlighted fields.";

    /// <summary>The message for a missing business name.</summary>
    public const string BusinessNameRequiredMessage = "Enter the business name.";

    /// <summary>The message for a missing tagline.</summary>
    public const string TaglineRequiredMessage = "Enter a tagline.";

    /// <summary>The message for a tagline over the limit.</summary>
    public const string TaglineTooLongMessage = "Keep the tagline to 160 characters or fewer.";

    /// <summary>The message for a turnaround line over the limit.</summary>
    public const string TurnaroundLineTooLongMessage = "Keep the turnaround line to 120 characters or fewer.";

    /// <summary>The message for the phone list rules.</summary>
    public const string TooManyPhonesMessage = "You can list up to 4 numbers.";

    /// <summary>The message for a number listed twice.</summary>
    public const string DuplicatePhoneMessage = "This number is already listed.";

    /// <summary>The message for a list with no single main number.</summary>
    public const string MainPhoneMessage = "Choose the main number.";

    // Used by EF Core (constructor binding) and by CreateDefault. The other mapped properties have private setters.
    private SiteSettings(
        int id,
        string businessName,
        string tagline,
        string timeZoneId,
        string currencyCode,
        string locale,
        string contactEmail,
        string contactPhone,
        string addressLine,
        string facebookUrl,
        DateTimeOffset createdAtUtc,
        Guid? createdById,
        DateTimeOffset? updatedAtUtc,
        Guid? updatedById,
        byte[] rowVersion)
    {
        Id = id;
        BusinessName = businessName;
        Tagline = tagline;
        TimeZoneId = timeZoneId;
        CurrencyCode = currencyCode;
        Locale = locale;
        ContactEmail = contactEmail;
        ContactPhone = contactPhone;
        AddressLine = addressLine;
        FacebookUrl = facebookUrl;
        CreatedAtUtc = createdAtUtc;
        CreatedById = createdById;
        UpdatedAtUtc = updatedAtUtc;
        UpdatedById = updatedById;
        RowVersion = rowVersion;
    }

    /// <summary>Primary key; always <see cref="SingletonId"/>.</summary>
    public int Id { get; private set; }

    /// <summary>The business name shown on the site.</summary>
    public string BusinessName { get; private set; }

    /// <summary>The shop's tagline, shown in the footer and as Home's description.</summary>
    public string Tagline { get; private set; }

    /// <summary>The about text, used in search results; null when not set.</summary>
    public string? AboutText { get; private set; }

    /// <summary>The turnaround promise shown on Home; null makes no time promise.</summary>
    public string? TurnaroundLine { get; private set; }

    /// <summary>Street and barangay; null when not set.</summary>
    public string? Street { get; private set; }

    /// <summary>Town or city; null when not set.</summary>
    public string? TownOrCity { get; private set; }

    /// <summary>Province; null when not set.</summary>
    public string? Province { get; private set; }

    /// <summary>Postal code; null when not set.</summary>
    public string? PostalCode { get; private set; }

    /// <summary>The directions link; null when not set.</summary>
    public string? DirectionsUrl { get; private set; }

    /// <summary>The map embed link; null when not set.</summary>
    public string? MapEmbedUrl { get; private set; }

    /// <summary>The Messenger link; null when not set.</summary>
    public string? MessengerUrl { get; private set; }

    /// <summary>The Instagram link; null when not set.</summary>
    public string? InstagramUrl { get; private set; }

    /// <summary>The TikTok link; null when not set.</summary>
    public string? TikTokUrl { get; private set; }

    /// <summary>The business time zone id (IANA or Windows), resolved through <c>TimeZoneResolver</c>.</summary>
    public string TimeZoneId { get; private set; }

    /// <summary>ISO 4217 currency code.</summary>
    public string CurrencyCode { get; private set; }

    /// <summary>Formatting locale, for example <c>en-PH</c>.</summary>
    public string Locale { get; private set; }

    /// <summary>The shop's email for staff use. It is never sent to a public page (D-25). Empty when not set.</summary>
    public string ContactEmail { get; private set; }

    /// <summary>The old single contact phone. Unused since the phone list; kept so no column is dropped (D-39).</summary>
    public string ContactPhone { get; private set; }

    /// <summary>The old single address line. Unused since the address parts; kept so no column is dropped (D-39).</summary>
    public string AddressLine { get; private set; }

    /// <summary>The Facebook page link; empty when not set.</summary>
    public string FacebookUrl { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

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
            SiteSettingsDefaults.Tagline,
            SiteSettingsDefaults.TimeZoneId,
            SiteSettingsDefaults.CurrencyCode,
            SiteSettingsDefaults.Locale,
            SiteSettingsDefaults.ContactEmail,
            SiteSettingsDefaults.ContactPhone,
            SiteSettingsDefaults.AddressLine,
            SiteSettingsDefaults.FacebookUrl,
            createdAtUtc,
            createdById: null,
            updatedAtUtc: null,
            updatedById: null,
            rowVersion: []);

    /// <summary>
    /// Replaces the business info: name, tagline, address parts, links and the shop email, and builds the phone rows that replace
    /// the stored list. Text is trimmed and an empty optional value becomes null (the email and the Facebook link, whose columns
    /// are required, become an empty string). The rules here keep every value inside its column; the request rules and the
    /// link allow-lists are checked before this is called. A failure changes nothing.
    /// </summary>
    /// <param name="values">The new values.</param>
    /// <param name="now">The current instant, which stamps the new phone rows.</param>
    /// <returns>The names of the fields that changed and the new phone rows, or a validation error naming each broken field.</returns>
    public Result<BusinessInfoChanges> UpdateBusinessInfo(BusinessInfo values, DateTimeOffset now) =>
        throw new NotImplementedException();

    /// <summary>
    /// Puts every <see cref="SiteSettingsDefaults"/> value back (business name, tagline, zone, currency, locale and the
    /// contact values, D-04). Used only by the dev seed.
    /// </summary>
    /// <param name="utcNow">The current instant, read from the caller's <c>TimeProvider</c>.</param>
    /// <returns>True when at least one value differed and was reset; false when nothing changed.</returns>
    public bool ResetToSeedDefaults(DateTimeOffset utcNow)
    {
        // Ordinal: the seed values must round-trip byte-exact, so a case-only difference is a difference.
        var differs =
            !string.Equals(BusinessName, SiteSettingsDefaults.BusinessName, StringComparison.Ordinal)
            || !string.Equals(Tagline, SiteSettingsDefaults.Tagline, StringComparison.Ordinal)
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
        Tagline = SiteSettingsDefaults.Tagline;
        TimeZoneId = SiteSettingsDefaults.TimeZoneId;
        CurrencyCode = SiteSettingsDefaults.CurrencyCode;
        Locale = SiteSettingsDefaults.Locale;
        ContactEmail = SiteSettingsDefaults.ContactEmail;
        ContactPhone = SiteSettingsDefaults.ContactPhone;
        AddressLine = SiteSettingsDefaults.AddressLine;
        FacebookUrl = SiteSettingsDefaults.FacebookUrl;
        UpdatedAtUtc = utcNow;
        UpdatedById = null;
        return true;
    }
}
