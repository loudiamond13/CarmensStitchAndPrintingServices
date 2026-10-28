using Csps.Domain.Orders;

namespace Csps.Application.Orders;

/// <summary>The wire keys of the two discount kinds (D-15): <c>fixed</c> and <c>percentage</c>, lower case.</summary>
public static class DiscountKindNames
{
    private const string FixedKey = "fixed";
    private const string PercentageKey = "percentage";

    /// <summary>Gets the key of a kind.</summary>
    /// <param name="kind">The kind.</param>
    /// <returns><c>fixed</c> or <c>percentage</c>.</returns>
    /// <exception cref="ArgumentOutOfRangeException">The number is not one of the two.</exception>
    public static string ToKey(DiscountKind kind) => kind switch
    {
        DiscountKind.Fixed => FixedKey,
        DiscountKind.Percentage => PercentageKey,
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown discount kind."),
    };

    /// <summary>Reads a key, ignoring case and spaces around it.</summary>
    /// <param name="text">The text sent by a client.</param>
    /// <param name="kind">The kind when the text is one of the two keys.</param>
    /// <returns>True when the text names a kind.</returns>
    public static bool TryParse(string? text, out DiscountKind kind)
    {
        var trimmed = text?.Trim();
        if (string.Equals(trimmed, FixedKey, StringComparison.OrdinalIgnoreCase))
        {
            kind = DiscountKind.Fixed;
            return true;
        }

        if (string.Equals(trimmed, PercentageKey, StringComparison.OrdinalIgnoreCase))
        {
            kind = DiscountKind.Percentage;
            return true;
        }

        kind = default;
        return false;
    }
}
