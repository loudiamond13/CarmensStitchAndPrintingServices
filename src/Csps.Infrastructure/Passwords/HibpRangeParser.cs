using System.Globalization;

namespace Csps.Infrastructure.Passwords;

/// <summary>Reads a Pwned Passwords range answer: lines of <c>35-character-hash-suffix:count</c> (AUTH-11).</summary>
internal static class HibpRangeParser
{
    /// <summary>The length of the hash part after the five-character prefix.</summary>
    internal const int SuffixLength = 35;

    /// <summary>Tells whether the body lists <paramref name="suffix"/> with a count above zero. Padding (count 0) and malformed lines are ignored.</summary>
    /// <param name="body">The response text.</param>
    /// <param name="suffix">The upper-case 35-character suffix of the password's SHA-1.</param>
    /// <returns>True when the password is in a breach.</returns>
    internal static bool Contains(string body, string suffix)
    {
        foreach (var line in body.AsSpan().EnumerateLines())
        {
            if (TryParse(line, out var lineSuffix, out var count) && count > 0 && lineSuffix.SequenceEqual(suffix.AsSpan()))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>Tells whether the body has at least one well-formed line. A padded answer always does, so a body without one is not a real answer.</summary>
    /// <param name="body">The response text.</param>
    /// <returns>True when a well-formed line exists.</returns>
    internal static bool HasEntries(string body)
    {
        foreach (var line in body.AsSpan().EnumerateLines())
        {
            if (TryParse(line, out _, out _))
            {
                return true;
            }
        }

        return false;
    }

    private static bool TryParse(ReadOnlySpan<char> line, out ReadOnlySpan<char> suffix, out long count)
    {
        suffix = default;
        count = 0;
        line = line.Trim();
        var colon = line.IndexOf(':');
        if (colon != SuffixLength)
        {
            return false;
        }

        suffix = line[..colon];
        return long.TryParse(line[(colon + 1)..], NumberStyles.None, CultureInfo.InvariantCulture, out count);
    }
}
