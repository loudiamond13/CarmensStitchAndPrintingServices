using Csps.Domain.Auditing;

namespace Csps.Domain.Analytics;

/// <summary>
/// Reduces a User-Agent to an operating system family label. The checks are ordered: iPhone and iPad come
/// before Mac (their headers also say "Mac OS X"), and Android and CrOS come before Linux. The header is
/// attacker-controlled, so there is no regular expression (CWE-1333) and the scan is capped (CWE-400).
/// </summary>
public static class OsFamily
{
    /// <summary>The longest label.</summary>
    public const int MaxLength = 20;

    /// <summary>Returns the OS family for <paramref name="userAgent"/>.</summary>
    /// <param name="userAgent">The raw User-Agent header, or null.</param>
    /// <returns>One of iOS, iPadOS, Android, Windows, macOS, ChromeOS, Linux or Other.</returns>
    public static string From(string? userAgent)
    {
        if (userAgent is null)
        {
            return "Other";
        }

        var ua = userAgent.AsSpan(0, Math.Min(userAgent.Length, UserAgentFamily.MaxScanLength));
        if (Has(ua, "iPhone") || Has(ua, "iPod"))
        {
            return "iOS";
        }

        if (Has(ua, "iPad"))
        {
            return "iPadOS";
        }

        if (Has(ua, "Android"))
        {
            return "Android";
        }

        if (Has(ua, "CrOS"))
        {
            return "ChromeOS";
        }

        if (Has(ua, "Windows"))
        {
            return "Windows";
        }

        if (Has(ua, "Macintosh") || Has(ua, "Mac OS X"))
        {
            return "macOS";
        }

        return Has(ua, "Linux") ? "Linux" : "Other";
    }

    private static bool Has(ReadOnlySpan<char> userAgent, string token) =>
        userAgent.Contains(token, StringComparison.OrdinalIgnoreCase);
}
