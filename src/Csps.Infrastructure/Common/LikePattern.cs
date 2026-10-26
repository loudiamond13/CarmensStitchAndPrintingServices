namespace Csps.Infrastructure.Common;

/// <summary>Builds SQL LIKE patterns from typed text so a typed wildcard stays literal (CWE-943).</summary>
internal static class LikePattern
{
    /// <summary>The escape character to pass as the third argument of <c>EF.Functions.Like</c>.</summary>
    public const string EscapeCharacter = "\\";

    /// <summary>Puts the escape character before itself and before the three characters LIKE treats as wildcards.</summary>
    /// <param name="text">The typed text.</param>
    /// <returns>The text with its wildcards made literal.</returns>
    public static string Escape(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        return text.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal)
            .Replace("[", "\\[", StringComparison.Ordinal);
    }

    /// <summary>Wraps the escaped text in percent signs, so the pattern matches anywhere in a value.</summary>
    /// <param name="text">The typed text.</param>
    /// <returns>The pattern.</returns>
    public static string Contains(string text) => "%" + Escape(text) + "%";
}
