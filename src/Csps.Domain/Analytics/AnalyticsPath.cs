namespace Csps.Domain.Analytics;

/// <summary>Reduces a page path to its pathname only (ANL-05).</summary>
public static class AnalyticsPath
{
    /// <summary>The longest cut path that is kept, in UTF-16 code units.</summary>
    public const int MaxLength = 2048;

    /// <summary>Returns the path cut at the first '?' or '#', or null when it is not a usable path.</summary>
    /// <param name="path">The path sent by the browser.</param>
    /// <returns>The cut path, or null.</returns>
    public static string? Cut(string? path) => null;
}
