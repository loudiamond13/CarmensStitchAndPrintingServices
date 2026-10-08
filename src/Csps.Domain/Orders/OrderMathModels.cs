namespace Csps.Domain.Orders;

/// <summary>How an order discount is valued.</summary>
public enum DiscountKind
{
    /// <summary>A fixed peso amount.</summary>
    Fixed,

    /// <summary>A percentage of the rounded items total.</summary>
    Percentage,
}

/// <summary>One order line for <see cref="OrderMath.Compute"/>.</summary>
/// <param name="Quantity">The number of pieces.</param>
/// <param name="UnitPrice">The price of one piece, in pesos.</param>
public sealed record OrderMathItem(int Quantity, decimal UnitPrice);

/// <summary>One order discount for <see cref="OrderMath.Compute"/>.</summary>
/// <param name="Kind">Fixed amount or percentage.</param>
/// <param name="Value">The peso amount (fixed) or the percent, where 7.5 means 7.5% (percentage).</param>
public sealed record OrderMathDiscount(DiscountKind Kind, decimal Value);

/// <summary>The server-computed order figures, every amount rounded to the centavo.</summary>
/// <param name="Total">The items total: the sum of quantity times unit price.</param>
/// <param name="Discount">The sum of the rounded discounts.</param>
/// <param name="Paid">The sum of the payments.</param>
/// <param name="Balance">Total minus discount minus paid. Negative when more was paid than is owed.</param>
/// <param name="Expenses">The sum of the order expenses.</param>
/// <param name="Profit">Total minus discount minus expenses.</param>
/// <param name="FullyPaid">True when the total is above zero and the balance is zero or less.</param>
public sealed record OrderMathTotals(
    decimal Total,
    decimal Discount,
    decimal Paid,
    decimal Balance,
    decimal Expenses,
    decimal Profit,
    bool FullyPaid);
