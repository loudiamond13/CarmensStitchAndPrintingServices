using System.Globalization;

namespace Csps.Domain.Orders;

/// <summary>The order number format, <c>ORD-{YYYY}-{NNNN}</c> (ORD-14, D-23). NNNN is at least four digits and is never cut short.</summary>
public static class OrderNumber
{
    private const string Prefix = "ORD-";
    private const int YearDigits = 4;
    private const int MinimumDigits = 4;

    /// <summary>Writes a number.</summary>
    /// <param name="year">The business year of the save.</param>
    /// <param name="sequence">The order's place in that year, from 1.</param>
    /// <returns>For example <c>ORD-2026-0001</c> or <c>ORD-2026-10000</c>.</returns>
    public static string Format(int year, int sequence) =>
        string.Create(CultureInfo.InvariantCulture, $"{Prefix}{year:D4}-{sequence:D4}");

    /// <summary>Reads a number written by <see cref="Format"/>.</summary>
    /// <param name="text">The text to read.</param>
    /// <param name="year">The year when the text is a number.</param>
    /// <param name="sequence">The place in that year when the text is a number.</param>
    /// <returns>True when the text is exactly four year digits and at least four sequence digits.</returns>
    public static bool TryParse(string? text, out int year, out int sequence)
    {
        year = 0;
        sequence = 0;
        if (text is null || !text.StartsWith(Prefix, StringComparison.Ordinal))
        {
            return false;
        }

        var parts = text[Prefix.Length..].Split('-');
        if (parts.Length != 2
            || parts[0].Length != YearDigits
            || parts[1].Length < MinimumDigits
            || !parts.All(static part => part.All(char.IsAsciiDigit))
            || !int.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var parsedYear)
            || !int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var parsedSequence))
        {
            return false;
        }

        year = parsedYear;
        sequence = parsedSequence;
        return true;
    }
}
