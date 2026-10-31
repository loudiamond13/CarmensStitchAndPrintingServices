namespace Csps.Domain.Orders;

/// <summary>
/// The authoritative order math (PRD section 5.1, D-09, WEB-07). Every figure staff see for a saved order comes from
/// here; the browser's preview (web/src/lib/csps.ts <c>orderTotals</c>) must agree to the centavo, which the shared
/// golden vectors in tests/fixtures/order-math-golden-vectors.json prove on both sides.
/// </summary>
/// <remarks>
/// <para>
/// Pinned operation order (the vector file's <c>operationOrder</c>): "round the items total; round each discount; sum
/// the discounts and round the sum; subtract (D-09)". Every rounding is to the centavo, half away from zero, never
/// banker's rounding: 7.5% of 17.00 = 1.275 gives 1.28.
/// </para>
/// <para>
/// The names are PRD section 5.1's (owner ruling D-41 R2-06, 2026-10-13): D-09's "items total" is the
/// <c>Subtotal</c>, <c>Total = Subtotal - Discount</c>, <c>Balance = Total - Paid</c> and
/// <c>Profit = Total - Expenses</c>. Refunds (D-13) raise the balance: <c>Balance = Total - Paid + Refunded</c>. The
/// customer credit is the balance when it is below zero (D-12). A cancelled order's profit is
/// <c>(Paid - Refunded) - Expenses</c> instead (D-36).
/// </para>
/// </remarks>
public static class OrderMath
{
    /// <summary>Computes the order figures with no refunds for an order that is not cancelled (D-09).</summary>
    /// <param name="items">The order lines.</param>
    /// <param name="discounts">The order discounts. A percentage applies to the rounded subtotal.</param>
    /// <param name="payments">The payment amounts.</param>
    /// <param name="expenses">The order expense amounts.</param>
    /// <returns>The figures, each rounded to the centavo, exactly as in the v2 golden vectors.</returns>
    /// <exception cref="ArgumentNullException">A list is null.</exception>
    /// <exception cref="ArgumentOutOfRangeException">A discount has a kind that is not defined.</exception>
    public static OrderMathResult Compute(
        IReadOnlyList<OrderMathItem> items,
        IReadOnlyList<OrderMathDiscount> discounts,
        IReadOnlyList<decimal> payments,
        IReadOnlyList<decimal> expenses) =>
        Compute(items, discounts, payments, [], expenses, cancelled: false);

    /// <summary>Computes the order figures in the pinned operation order (D-09), with refunds.</summary>
    /// <param name="items">The order lines.</param>
    /// <param name="discounts">The order discounts. A percentage applies to the rounded subtotal.</param>
    /// <param name="payments">The payment amounts.</param>
    /// <param name="refunds">The refund amounts. Each refund hands money back, so it raises the balance (D-13).</param>
    /// <param name="expenses">The order expense amounts.</param>
    /// <param name="cancelled">True when the order is cancelled; profit then follows D-36.</param>
    /// <returns>
    /// The figures, each rounded to the centavo. The total and the balance may be negative (a discount above the
    /// subtotal, or payments above what is owed); this is arithmetic only and implies no business rule.
    /// </returns>
    /// <exception cref="ArgumentNullException">A list is null.</exception>
    /// <exception cref="ArgumentOutOfRangeException">A discount has a kind that is not defined.</exception>
    public static OrderMathResult Compute(
        IReadOnlyList<OrderMathItem> items,
        IReadOnlyList<OrderMathDiscount> discounts,
        IReadOnlyList<decimal> payments,
        IReadOnlyList<decimal> refunds,
        IReadOnlyList<decimal> expenses,
        bool cancelled)
    {
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(discounts);
        ArgumentNullException.ThrowIfNull(payments);
        ArgumentNullException.ThrowIfNull(refunds);
        ArgumentNullException.ThrowIfNull(expenses);

        // 1. Round the items total (the PRD Subtotal).
        var subtotal = Round(items.Sum(item => item.Quantity * item.UnitPrice));

        // 2. Round each discount. 3. Sum the discounts and round the sum.
        var discount = Round(discounts.Sum(d => DiscountAmount(d, subtotal)));

        var paid = Round(payments.Sum());
        var refunded = Round(refunds.Sum());
        var expenseTotal = Round(expenses.Sum());

        // 4. Subtract (PRD section 5.1).
        var total = subtotal - discount;
        var balance = total - paid + refunded;

        // D-12: the shop owes the customer what was paid above the total. Zero is written as 0.00, never -0.00.
        var customerCredit = balance < 0m ? -balance : 0.00m;

        // D-36: a cancelled order keeps only the money still held (paid minus refunded) against its expenses (D-10).
        var profit = cancelled ? paid - refunded - expenseTotal : total - expenseTotal;

        // D-41 R2-06 (NET-IN-01 ruled keep): fully paid needs a subtotal above zero, not a total above zero.
        return new OrderMathResult(
            subtotal,
            discount,
            total,
            paid,
            balance,
            expenseTotal,
            profit,
            FullyPaid: subtotal > 0m && balance <= 0m)
        {
            Refunded = refunded,
            CustomerCredit = customerCredit,
        };
    }

    /// <summary>Works out the pesos one discount comes to, rounded to the centavo, half away from zero (D-09, D-94).</summary>
    /// <param name="discount">The discount.</param>
    /// <param name="subtotal">The rounded subtotal a percentage applies to.</param>
    /// <returns>The value itself for a fixed discount, or the percent of the subtotal.</returns>
    /// <exception cref="ArgumentNullException">The discount is null.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The discount has a kind that is not defined.</exception>
    public static decimal DiscountAmount(OrderMathDiscount discount, decimal subtotal)
    {
        ArgumentNullException.ThrowIfNull(discount);

        // An undefined kind (out of range, or the unset value 0) fails loudly: guessing "fixed" would turn a mis-mapped
        // 10 percent into 10 pesos on the authoritative money path (NET-WR-01).
        return Round(discount.Kind switch
        {
            DiscountKind.Fixed => discount.Value,
            DiscountKind.Percentage => subtotal * discount.Value / 100m,
            _ => throw new ArgumentOutOfRangeException(nameof(discount), discount.Kind, "Unknown discount kind."),
        });
    }

    private static decimal Round(decimal amount) => Math.Round(amount, 2, MidpointRounding.AwayFromZero);
}
