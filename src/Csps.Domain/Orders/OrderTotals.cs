namespace Csps.Domain.Orders;

/// <summary>
/// The money figures of an order as <see cref="OrderMath"/> works them out (ORD-20). Subtotal is before discount, Total is after
/// discount, Balance is total minus paid plus refunded, and CustomerCredit is the balance below zero as a positive amount.
/// </summary>
/// <param name="Subtotal">The sum of the line totals.</param>
/// <param name="Discount">The sum of the discounts.</param>
/// <param name="Total">The subtotal minus the discount.</param>
/// <param name="Paid">The sum of the payments.</param>
/// <param name="Refunded">The sum of the refunds.</param>
/// <param name="Balance">The total minus paid plus refunded.</param>
/// <param name="CustomerCredit">What the shop owes the customer; 0.00 when nothing.</param>
/// <param name="Expenses">The sum of the order expenses.</param>
/// <param name="Profit">The profit, following the cancelled-order rule.</param>
/// <param name="FullyPaid">True when the subtotal is above zero and the balance is zero or less.</param>
public sealed record OrderTotals(
    decimal Subtotal,
    decimal Discount,
    decimal Total,
    decimal Paid,
    decimal Refunded,
    decimal Balance,
    decimal CustomerCredit,
    decimal Expenses,
    decimal Profit,
    bool FullyPaid);
