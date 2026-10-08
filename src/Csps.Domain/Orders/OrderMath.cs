namespace Csps.Domain.Orders;

/// <summary>
/// The authoritative order math (PRD section 5.1, D-09, WEB-07). Every figure staff see for an order comes from here;
/// the browser's preview (web/src/lib/csps.ts <c>orderTotals</c>) must agree to the centavo, which the shared golden
/// vectors in tests/fixtures/order-math-golden-vectors.json prove on both sides.
/// </summary>
/// <remarks>
/// Pinned operation order (the vector file's <c>operationOrder</c>): "round the items total; round each discount; sum
/// the discounts and round the sum; subtract (D-09)". Every rounding is to the centavo, half away from zero
/// (<see cref="MidpointRounding.AwayFromZero"/>), never banker's rounding: 7.5% of 17.00 = 1.275 gives 1.28.
/// </remarks>
public static class OrderMath
{
    private const int Centavos = 2;
    private const decimal Hundred = 100m;

    /// <summary>Computes the order figures in the pinned operation order.</summary>
    /// <param name="items">The order lines.</param>
    /// <param name="discounts">The order discounts. A percentage applies to the rounded items total.</param>
    /// <param name="payments">The payment amounts.</param>
    /// <param name="expenses">The order expense amounts.</param>
    /// <returns>
    /// The figures, each rounded to the centavo. The balance may be negative (a discount above the total, or payments
    /// above what is owed); this is arithmetic only and implies no business rule.
    /// </returns>
    /// <exception cref="ArgumentNullException">A list is null.</exception>
    public static OrderMathTotals Compute(
        IReadOnlyList<OrderMathItem> items,
        IReadOnlyList<OrderMathDiscount> discounts,
        IReadOnlyList<decimal> payments,
        IReadOnlyList<decimal> expenses)
    {
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(discounts);
        ArgumentNullException.ThrowIfNull(payments);
        ArgumentNullException.ThrowIfNull(expenses);

        // 1. Round the items total.
        var total = Round(items.Sum(item => item.Quantity * item.UnitPrice));

        // 2. Round each discount. 3. Sum the discounts and round the sum.
        var discount = Round(discounts.Sum(d => DiscountAmount(d, total)));

        var paid = Round(payments.Sum());
        var expenseTotal = Round(expenses.Sum());

        // 4. Subtract.
        var balance = total - discount - paid;
        var profit = total - discount - expenseTotal;

        return new OrderMathTotals(total, discount, paid, balance, expenseTotal, profit, total > 0m && balance <= 0m);
    }

    private static decimal DiscountAmount(OrderMathDiscount discount, decimal itemsTotal) =>
        Round(discount.Kind == DiscountKind.Percentage ? itemsTotal * discount.Value / Hundred : discount.Value);

    private static decimal Round(decimal amount) => Math.Round(amount, Centavos, MidpointRounding.AwayFromZero);
}
