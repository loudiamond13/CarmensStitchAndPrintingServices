namespace Csps.Domain.Auditing;

/// <summary>
/// Reduces a User-Agent header to one family label (D-24), without regular expressions (CWE-1333).
/// </summary>
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

    /// <summary>Apple Safari on macOS or iOS.</summary>
    public const string Safari = "Safari";

    /// <summary>Google Chrome, including Chrome on iOS.</summary>
    public const string Chrome = "Chrome";

    /// <summary>Any other non-empty User-Agent.</summary>
    public const string Other = "Other";

    /// <summary>The header was missing or blank.</summary>
    public const string Unknown = "Unknown";

    /// <summary>Returns the family label for <paramref name="userAgent"/>.</summary>
    /// <param name="userAgent">The raw User-Agent header, or null.</param>
    /// <returns>A family label.</returns>
    public static string Classify(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent))
        {
            return Unknown;
        }

        return userAgent.Contains("Chrome/", StringComparison.OrdinalIgnoreCase) ? Chrome : Other;
    }
}
