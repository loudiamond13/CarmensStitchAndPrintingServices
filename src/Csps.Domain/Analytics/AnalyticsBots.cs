using Csps.Domain.Auditing;

namespace Csps.Domain.Analytics;

/// <summary>
/// Tells crawlers and test runners apart from visitors, so they are not counted. It reuses the audit log's
/// <see cref="UserAgentFamily"/> (Bot and Unknown) and adds four analytics-only tokens in its own list, so the
/// audit log's labels do not change. The header is attacker-controlled, so there is no regular expression
/// (CWE-1333) and the scan is capped (CWE-400).
/// </summary>
public static class AnalyticsBots
{
    private static readonly string[] ExtraTokens = ["HeadlessChrome", "Lighthouse", "PTST", "OWASP-ZAP"];

    /// <summary>Returns true when the visit should not be counted.</summary>
    /// <param name="userAgent">The raw User-Agent header, or null.</param>
    /// <returns>True for a bot, a blank header or a test runner.</returns>
    public static bool IsBot(string? userAgent)
    {
        if (UserAgentFamily.Classify(userAgent) is UserAgentFamily.Bot or UserAgentFamily.Unknown)
        {
            return true;
        }

        var ua = userAgent.AsSpan(0, Math.Min(userAgent!.Length, UserAgentFamily.MaxScanLength));
        foreach (var token in ExtraTokens)
        {
            if (ua.Contains(token, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }
}
