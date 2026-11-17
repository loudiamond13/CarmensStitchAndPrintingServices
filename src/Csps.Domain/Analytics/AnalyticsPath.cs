namespace Csps.Domain.Analytics;

/// <summary>
/// Reduces a page path to its pathname only (ANL-05), so a query string or fragment is never stored. The path
/// is attacker-controlled, so it is sliced with plain character checks: no regular expression and no Uri parser.
/// </summary>
public static class AnalyticsPath
{
    /// <summary>The longest cut path that is kept, in UTF-16 code units.</summary>
    public const int MaxLength = 2048;

    /// <summary>Returns the path cut at the first '?' or '#', or null when it is not a usable path.</summary>
    /// <param name="path">The path sent by the browser.</param>
    /// <returns>The cut path, starting with '/' and at most <see cref="MaxLength"/> long; otherwise null.</returns>
    public static string? Cut(string? path)
    {
        if (string.IsNullOrEmpty(path))
        {
            return null;
        }

        var end = path.AsSpan().IndexOfAny('?', '#');
        var cut = end < 0 ? path : path[..end];
        return cut.Length is > 0 and <= MaxLength && cut[0] == '/' ? cut : null;
    }
}
