namespace Csps.Application.QuoteRequests;

/// <summary>Turns the inbox search text into the digits that are matched against the stored phone number (D-18).</summary>
public static class QuoteRequestSearchText
{
    private const int MinDigits = 3;
    private const string CountryCode = "63";
    private const string TrunkPrefix = "0";

    /// <summary>
    /// Keeps the digits of the text and drops a leading 63 or 0, because the stored number is E.164 (<c>+639171234567</c>), so a
    /// local 0917 and +63 917 search the same digits. Fewer than 3 digits left is no phone search, so a prefix such as 639 never
    /// matches every number.
    /// </summary>
    /// <param name="text">The typed search text.</param>
    /// <returns>The digits to match, or null when the text has too few.</returns>
    public static string? PhoneDigits(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var digits = new string([.. text.Where(char.IsAsciiDigit)]);
        if (digits.StartsWith(CountryCode, StringComparison.Ordinal))
        {
            digits = digits[CountryCode.Length..];
        }
        else if (digits.StartsWith(TrunkPrefix, StringComparison.Ordinal))
        {
            digits = digits[TrunkPrefix.Length..];
        }

        return digits.Length >= MinDigits ? digits : null;
    }
}
