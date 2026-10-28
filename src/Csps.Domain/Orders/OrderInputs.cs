namespace Csps.Domain.Orders;

/// <summary>The customer and date details of an order (D-21, D-22). Text is checked and trimmed by <see cref="OrderRules.CheckDetails"/>.</summary>
/// <param name="CustomerName">The customer's name.</param>
/// <param name="TeamName">The team or club name; empty means none.</param>
/// <param name="ContactNumber">The contact number.</param>
/// <param name="Email">The email address; empty means none.</param>
/// <param name="Address">The address; empty means none.</param>
/// <param name="OrderDate">The day the order was taken.</param>
/// <param name="DueDate">The day it is due.</param>
/// <param name="Notes">Free notes; empty means none.</param>
public sealed record OrderDetails(
    string CustomerName,
    string? TeamName,
    string? ContactNumber,
    string? Email,
    string? Address,
    DateOnly OrderDate,
    DateOnly? DueDate,
    string? Notes);

/// <summary>One line of a new order (ORD-13, D-18, D-30).</summary>
/// <param name="ProductTypeId">The product type.</param>
/// <param name="Description">What the line is.</param>
/// <param name="SizeVariant">The size or variant; empty means none.</param>
/// <param name="Quantity">How many.</param>
/// <param name="UnitPrice">The price of one, in pesos.</param>
public sealed record NewOrderItem(Guid ProductTypeId, string Description, string? SizeVariant, int Quantity, decimal UnitPrice);

/// <summary>One discount of a new or saved order (D-15, ORD-05).</summary>
/// <param name="Kind">Fixed amount or percentage.</param>
/// <param name="Value">The peso amount (fixed) or the percent (percentage), at most two decimal places.</param>
/// <param name="Reason">Why the discount is given, 1 to <see cref="OrderRules.DiscountReasonMaxLength"/> characters.</param>
public sealed record NewOrderDiscount(DiscountKind Kind, decimal Value, string Reason);

/// <summary>One payment of a new or saved order (ORD-05, ORD-22, D-30).</summary>
/// <param name="PaymentDate">The day the money was received; never after the business today.</param>
/// <param name="Amount">The amount in pesos, above 0.00 and at most 1,000,000.00, with at most two decimal places.</param>
/// <param name="PaymentMethodId">The payment method.</param>
/// <param name="Reference">A reference such as a transfer number; empty means none.</param>
/// <param name="Notes">Free notes; empty means none.</param>
/// <param name="ReceivedByUserId">The staff member who received the money.</param>
public sealed record NewOrderPayment(DateOnly PaymentDate, decimal Amount, Guid PaymentMethodId, string? Reference, string? Notes, Guid ReceivedByUserId);

/// <summary>One refund of a saved order (ORD-18, D-07, D-30).</summary>
/// <param name="RefundDate">The day the money was handed back; never after the business today.</param>
/// <param name="Amount">The amount in pesos, above 0.00 and at most 1,000,000.00, with at most two decimal places.</param>
/// <param name="Reason">Why the money is handed back, 1 to <see cref="OrderRules.RefundReasonMaxLength"/> characters.</param>
/// <param name="RefundedByUserId">The staff member who handed the money back.</param>
public sealed record NewOrderRefund(DateOnly RefundDate, decimal Amount, string Reason, Guid RefundedByUserId);

/// <summary>One order expense of a new or saved order (ORD-05, ORD-23, D-30).</summary>
/// <param name="ExpenseDate">The day of the expense; any past day, up to 30 days after the business today.</param>
/// <param name="Amount">The amount in pesos, above 0.00 and at most 1,000,000.00, with at most two decimal places.</param>
/// <param name="OrderExpenseCategoryId">The order expense category.</param>
/// <param name="Description">A short description; empty means none.</param>
/// <param name="PaidByUserId">The staff member who paid.</param>
public sealed record NewOrderExpense(DateOnly ExpenseDate, decimal Amount, Guid OrderExpenseCategoryId, string? Description, Guid PaidByUserId);

/// <summary>Everything a new order is made from.</summary>
/// <param name="Details">The customer and date details.</param>
/// <param name="Status">The status to start in; only an active status is allowed (D-22).</param>
/// <param name="Items">The lines, one to <see cref="OrderRules.MaxItems"/>.</param>
public sealed record NewOrder(OrderDetails Details, OrderStatus Status, IReadOnlyList<NewOrderItem> Items)
{
    /// <summary>Gets the discounts, none to <see cref="OrderRules.MaxDiscounts"/>; empty by default.</summary>
    public IReadOnlyList<NewOrderDiscount> Discounts { get; init; } = [];

    /// <summary>Gets the payments already received, none to <see cref="OrderRules.MaxPayments"/>; empty by default. Their sum may not pass the total.</summary>
    public IReadOnlyList<NewOrderPayment> Payments { get; init; } = [];

    /// <summary>Gets the order expenses, none to <see cref="OrderRules.MaxExpenses"/>; empty by default.</summary>
    public IReadOnlyList<NewOrderExpense> Expenses { get; init; } = [];
}
