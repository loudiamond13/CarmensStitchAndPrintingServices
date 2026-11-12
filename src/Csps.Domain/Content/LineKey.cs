using System.Globalization;
using System.Text;

namespace Csps.Domain.Content;

/// <summary>
/// The URL key of a product line (UI-SPEC line keys, CWE-601). A key is made once from the short name: lower case <c>a</c> to <c>z</c> and
/// <c>0</c> to <c>9</c>, words joined by <c>-</c>, and a number suffix when the key is taken. It never changes afterwards, so shared links
/// keep working. A key reaches a link only after <see cref="IsValid"/> says it is well formed.
/// </summary>
public static class LineKey
{
    private const string Fallback = "line";

    /// <summary>Makes the key for a new line from its short name.</summary>
    /// <param name="shortName">The short name.</param>
    /// <param name="taken">The keys that exist already, lower case.</param>
    /// <returns>A well-formed key that is not in <paramref name="taken"/>.</returns>
    public static string From(string shortName, IReadOnlySet<string> taken)
    {
        ArgumentNullException.ThrowIfNull(shortName);
        ArgumentNullException.ThrowIfNull(taken);

        var slug = Slug(shortName);
        if (slug.Length == 0)
        {
            slug = Fallback;
        }

        if (slug.Length > ProductLine.KeyMaxLength)
        {
            slug = slug[..ProductLine.KeyMaxLength].TrimEnd('-');
        }

        if (!taken.Contains(slug))
        {
            return slug;
        }

        for (var number = 2; ; number++)
        {
            var suffix = string.Create(CultureInfo.InvariantCulture, $"-{number}");
            var stem = slug.Length + suffix.Length > ProductLine.KeyMaxLength
                ? slug[..(ProductLine.KeyMaxLength - suffix.Length)].TrimEnd('-')
                : slug;
            var candidate = string.Concat(stem, suffix);
            if (!taken.Contains(candidate))
            {
                return candidate;
            }
        }
    }

    /// <summary>Tells whether a text is a well-formed key: one to 40 characters, lower case letters and digits in words joined by single dashes.</summary>
    /// <param name="key">The text.</param>
    /// <returns>True for a key.</returns>
    public static bool IsValid(string? key)
    {
        if (string.IsNullOrEmpty(key) || key.Length > ProductLine.KeyMaxLength)
        {
            return false;
        }

        var afterDash = true;
        foreach (var character in key)
        {
            if (character == '-')
            {
                if (afterDash)
                {
                    return false;
                }

                afterDash = true;
            }
            else if (character is (>= 'a' and <= 'z') or (>= '0' and <= '9'))
            {
                afterDash = false;
            }
            else
            {
                return false;
            }
        }

        return !afterDash;
    }

    private static string Slug(string text)
    {
        var builder = new StringBuilder(text.Length);
        var wordBreak = false;
        foreach (var character in text)
        {
            if (char.IsAsciiLetterOrDigit(character))
            {
                if (wordBreak && builder.Length > 0)
                {
                    builder.Append('-');
                }

                wordBreak = false;
                builder.Append(char.ToLowerInvariant(character));
            }
            else
            {
                wordBreak = true;
            }
        }

        return builder.ToString();
    }
}
