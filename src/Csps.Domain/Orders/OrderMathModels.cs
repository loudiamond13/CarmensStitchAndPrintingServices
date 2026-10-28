namespace Csps.Domain.Orders;

/// <summary>How an order discount is valued.</summary>
/// <remarks>
/// The values start at 1, so an unset kind (<c>default</c>, 0) is never a valid kind and <see cref="OrderMath"/>
/// rejects it instead of reading it as a fixed amount (NET-WR-01).
/// </remarks>
public enum DiscountKind
{
    /// <summary>A fixed peso amount.</summary>
    Fixed = 1,

    /// <summary>A percentage of the rounded subtotal (PRD section 5.1).</summary>
    Percentage = 2,
}

/// <summary>One order line for <see cref="OrderMath"/>.</summary>
/// <param name="Quantity">The number of pieces.</param>
/// <param name="UnitPrice">The price of one piece, in pesos.</param>
public sealed record OrderMathItem(int Quantity, decimal UnitPrice);

/// <summary>One order discount for <see cref="OrderMath"/>.</summary>
/// <param name="Kind">Fixed amount or percentage.</param>
/// <param name="Value">The peso amount (fixed) or the percent, where 7.5 means 7.5% (percentage).</param>
public sealed record OrderMathDiscount(DiscountKind Kind, decimal Value);

/// <summary>
/// The server-computed order figures, every amount rounded to the centavo (D-09), named as in PRD section 5.1 (owner
/// ruling D-41 R2-06, 2026-10-13).
/// </summary>
/// <param name="Subtotal">
/// PRD section 5.1 <c>Subtotal</c>, the amount before discount: the rounded sum of quantity times unit price (D-09's
/// "items total").
/// </param>
/// <param name="Discount">PRD section 5.1 <c>DiscountAmount</c>: the rounded sum of the rounded discounts.</param>
/// <param name="Total">
/// PRD section 5.1 <c>Total</c>, the amount after discount: subtotal minus discount. Negative when the discount is above
/// the subtotal.
/// </param>
/// <param name="Paid">PRD section 5.1 <c>TotalPaid</c>: the sum of the payments.</param>
/// <param name="Balance">
/// PRD section 5.1 <c>Balance</c>: total minus paid plus refunded. Negative when more was paid than is owed.
/// </param>
/// <param name="Expenses">PRD section 5.1 <c>TotalOrderExpenses</c>: the sum of the order expenses.</param>
/// <param name="Profit">
/// Total minus expenses (the internal estimated profit). For a cancelled order it is paid minus refunded minus
/// expenses (D-36), so a fully refunded cancelled order shows a loss of its expenses (D-10).
/// </param>
/// <param name="FullyPaid">
/// True when the subtotal is above zero and the balance is zero or less. Owner ruling D-41 R2-06 (2026-10-13;
/// NET-IN-01, ruled keep): a fully discounted order with no payment reads fully paid, because nothing is owed, and an
/// empty order does not.
/// </param>
public sealed record OrderMathResult(
    decimal Subtotal,
    decimal Discount,
    decimal Total,
    decimal Paid,
    decimal Balance,
    decimal Expenses,
    decimal Profit,
    bool FullyPaid)
{
    /// <summary>The sum of the refunds, rounded to the centavo. Zero when nothing was refunded.</summary>
    public decimal Refunded { get; init; }

    /// <summary>What the shop owes the customer: the balance when it is below zero, otherwise zero (D-12).</summary>
    public decimal CustomerCredit { get; init; }
}
