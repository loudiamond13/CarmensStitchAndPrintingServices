namespace Csps.Domain.Auditing;

/// <summary>
/// Reduces a User-Agent header to one family label (D-24), without regular expressions (CWE-1333).
/// </summary>
public static class UserAgentFamily
{
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
