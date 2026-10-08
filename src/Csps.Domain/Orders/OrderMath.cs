namespace Csps.Domain.Orders;

/// <summary>The authoritative order math (D-09, WEB-07). Inert until implemented.</summary>
public static class OrderMath
{
    /// <summary>Computes the order figures.</summary>
    /// <param name="items">The order lines.</param>
    /// <param name="discounts">The order discounts.</param>
    /// <param name="payments">The payment amounts.</param>
    /// <param name="expenses">The order expense amounts.</param>
    /// <returns>The figures.</returns>
    public static OrderMathResult Compute(
        IReadOnlyList<OrderMathItem> items,
        IReadOnlyList<OrderMathDiscount> discounts,
        IReadOnlyList<decimal> payments,
        IReadOnlyList<decimal> expenses) => new(0m, 0m, 0m, 0m, 0m, 0m, false);
}
