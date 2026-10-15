using System.Globalization;

namespace Csps.Domain.Identity;

/// <summary>The emailed sign-in code: exactly six ASCII digits, leading zeros kept.</summary>
public static class SixDigitCode
{
    /// <summary>Number of digits in a code.</summary>
    public const int Length = 6;

    private const int MaxValue = 999_999;

    /// <summary>Checks that <paramref name="code"/> is exactly six characters, each '0' to '9'.</summary>
    /// <param name="code">The text a person typed.</param>
    /// <returns>True when the text is a well-formed code.</returns>
    public static bool IsWellFormed(string? code) =>
        code is { Length: Length } && code.AsSpan().IndexOfAnyExceptInRange('0', '9') < 0;

    /// <summary>Formats a number as a code, with the invariant culture and leading zeros.</summary>
    /// <param name="value">A number from 0 to 999999.</param>
    /// <returns>The six-digit text.</returns>
    public static string Format(int value)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(value);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(value, MaxValue);
        return value.ToString("D6", CultureInfo.InvariantCulture);
    }
}
