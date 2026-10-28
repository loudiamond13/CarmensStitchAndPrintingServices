using System.Globalization;

namespace Csps.Domain.Orders;

/// <summary>Peso text for the domain messages that name an amount.</summary>
public static class Pesos
{
    /// <summary>Formats an amount as the peso sign, grouped thousands and two decimals.</summary>
    /// <param name="amount">The amount; messages pass it as a positive figure.</param>
    /// <returns>For example <c>₱9,327.50</c>.</returns>
    public static string Format(decimal amount) => "₱" + amount.ToString("N2", CultureInfo.InvariantCulture);
}
