namespace Csps.Domain.Auditing;

/// <summary>
/// Reduces a User-Agent header to one family label (D-24, RA 10173 data minimization), so the raw header is
/// never stored. The audit log and, later, visitor analytics use the same rule.
/// </summary>
/// <remarks>
/// The header is attacker-controlled, so the classifier uses no regular expressions (CWE-1333) and reads at
/// most the first <see cref="MaxScanLength"/> characters (CWE-400). It then applies ordered,
/// case-insensitive substring checks. The order matters: bots and the Facebook and Instagram in-app
/// browsers (most of the site's traffic) are checked first, and Edge, Opera and Samsung Internet come before
/// Chrome, because their headers also contain <c>Chrome/</c>.
/// </remarks>
public static class UserAgentFamily
{
    /// <summary>A search engine, crawler or link-preview fetcher.</summary>
    public const string Bot = "Bot";

    /// <summary>The Facebook app's built-in browser.</summary>
    public const string FacebookInApp = "Facebook in-app";

    /// <summary>The Instagram app's built-in browser.</summary>
    public const string InstagramInApp = "Instagram in-app";

    /// <summary>Microsoft Edge on desktop, Android or iOS.</summary>
    public const string Edge = "Edge";

    /// <summary>Opera.</summary>
    public const string Opera = "Opera";

    /// <summary>Samsung Internet.</summary>
    public const string SamsungInternet = "Samsung Internet";

    /// <summary>Mozilla Firefox, including Firefox on iOS.</summary>
    public const string Firefox = "Firefox";

    /// <summary>Google Chrome, including Chrome on iOS.</summary>
    public const string Chrome = "Chrome";

    /// <summary>Apple Safari on macOS or iOS.</summary>
    public const string Safari = "Safari";

    /// <summary>Any other non-blank User-Agent.</summary>
    public const string Other = "Other";

    /// <summary>The header was missing or blank.</summary>
    public const string Unknown = "Unknown";

    /// <summary>How many leading characters of the header are read; the rest is ignored.</summary>
    internal const int MaxScanLength = 512;

    /// <summary>Returns the family label for <paramref name="userAgent"/>.</summary>
    /// <param name="userAgent">The raw User-Agent header, or null.</param>
    /// <returns>One of the label constants on this type.</returns>
    public static string Classify(string? userAgent)
    {
        if (userAgent is null)
        {
            return Unknown;
        }

        var ua = userAgent.AsSpan(0, Math.Min(userAgent.Length, MaxScanLength));
        if (ua.IsWhiteSpace())
        {
            return Unknown;
        }

        if (Has(ua, "bot") || Has(ua, "crawl") || Has(ua, "spider") || Has(ua, "slurp")
            || Has(ua, "facebookexternalhit"))
        {
            return Bot;
        }

        if (Has(ua, "FBAN") || Has(ua, "FBAV"))
        {
            return FacebookInApp;
        }

        if (Has(ua, "Instagram"))
        {
            return InstagramInApp;
        }

        if (Has(ua, "Edg/") || Has(ua, "EdgA/") || Has(ua, "EdgiOS/"))
        {
            return Edge;
        }

        if (Has(ua, "OPR/") || Has(ua, "Opera"))
        {
            return Opera;
        }

        if (Has(ua, "SamsungBrowser"))
        {
            return SamsungInternet;
        }

        if (Has(ua, "Firefox/") || Has(ua, "FxiOS"))
        {
            return Firefox;
        }

        if (Has(ua, "CriOS") || Has(ua, "Chrome/"))
        {
            return Chrome;
        }

        if (Has(ua, "Safari") && Has(ua, "Version/"))
        {
            return Safari;
        }

        return Other;
    }

    private static bool Has(ReadOnlySpan<char> userAgent, string token) =>
        userAgent.Contains(token, StringComparison.OrdinalIgnoreCase);
}
