namespace Csps.Domain.Content;

/// <summary>
/// The values the SiteSettings singleton is seeded with (D-04). The business name and tagline are real. The shop email
/// and the Facebook link start empty. The old phone and address columns keep their bracket placeholders but are no longer read
/// or shown. Never replace a placeholder with invented, real-looking contact details.
/// </summary>
public static class SiteSettingsDefaults
{
    /// <summary>The real business name.</summary>
    public const string BusinessName = "Carmen's Stitch & Printing Services";

    /// <summary>The approved tagline (D-36).</summary>
    public const string Tagline = "Custom tailoring and full-sublimation printing for teams, leagues and riding groups.";

    /// <summary>The business time zone (IANA id, D-02).</summary>
    public const string TimeZoneId = "Asia/Manila";

    /// <summary>ISO 4217 code of the single currency, Philippine peso (D-01).</summary>
    public const string CurrencyCode = "PHP";

    /// <summary>Formatting locale for money and dates (D-01).</summary>
    public const string Locale = "en-PH";

    /// <summary>The shop email starts empty: the owner types the real one (D-25, no invented values).</summary>
    public const string ContactEmail = "";

    /// <summary>Placeholder contact phone (UI spec), to be filled in by the owner.</summary>
    public const string ContactPhone = "[0917 000 0000]";

    /// <summary>Placeholder shop address (UI spec), to be filled in by the owner.</summary>
    public const string AddressLine = "[Shop address], [City], Philippines";

    /// <summary>The Facebook page link starts empty: an unset link is left out of the public site.</summary>
    public const string FacebookUrl = "";

    /// <summary>
    /// Fixed creation stamp of the migration-seeded row. A literal, never a clock read, so the EF model
    /// stays stable between migrations (research Pattern 6).
    /// </summary>
    public static readonly DateTimeOffset SeededAtUtc = new(2026, 10, 7, 0, 0, 0, TimeSpan.Zero);
}
