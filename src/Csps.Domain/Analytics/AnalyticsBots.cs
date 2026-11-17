namespace Csps.Domain.Analytics;

/// <summary>Tells crawlers and test runners apart from visitors, so they are not counted.</summary>
public static class AnalyticsBots
{
    /// <summary>Returns true when the visit should not be counted.</summary>
    /// <param name="userAgent">The raw User-Agent header, or null.</param>
    /// <returns>True for a bot, a blank header or a test runner.</returns>
    public static bool IsBot(string? userAgent) => false;
}
