namespace Csps.Application.Orders;

/// <summary>
/// The New Order form (ORD-03). Any other member in the body, such as a forged <c>createdById</c>, <c>number</c> or <c>totals</c>, is
/// ignored: who recorded the order, its number and its money figures come from the token, the clock and the server (SEC-08, ORD-20).
/// </summary>
/// <param name="CustomerName">The customer's name.</param>
/// <param name="TeamName">The team or club name.</param>
/// <param name="ContactNumber">The contact number.</param>
/// <param name="Email">The email address.</param>
/// <param name="Address">The address.</param>
/// <param name="OrderDate">The day the order was taken, <c>yyyy-MM-dd</c>.</param>
/// <param name="DueDate">The day it is due, <c>yyyy-MM-dd</c>.</param>
/// <param name="Status">The status to start in: pending, mockup, production, ready or delivered; pending when not sent.</param>
/// <param name="Notes">Free notes.</param>
/// <param name="Items">The lines, one to 100.</param>
/// <param name="Discounts">The discounts, none to 20; saved in the same transaction as the order.</param>
/// <param name="Payments">The payments already received, none to 100; saved in the same transaction as the order. Their sum may not pass the total after discounts.</param>
public sealed record CreateOrderRequest(
    string? CustomerName,
    string? TeamName,
    string? ContactNumber,
    string? Email,
    string? Address,
    string? OrderDate,
    string? DueDate,
    string? Status,
    string? Notes,
    IReadOnlyList<OrderItemRequest>? Items,
    IReadOnlyList<OrderDiscountRequest>? Discounts = null,
    IReadOnlyList<OrderPaymentRequest>? Payments = null) : IOrderDetailsFields
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static CreateOrderRequest Empty { get; } = new(null, null, null, null, null, null, null, null, null, null);
}

/// <summary>One line of the New Order form (ORD-13).</summary>
/// <param name="ProductTypeId">The product type.</param>
/// <param name="Description">What the line is.</param>
/// <param name="SizeVariant">The size or variant.</param>
/// <param name="Quantity">How many.</param>
/// <param name="UnitPrice">The price of one, in pesos.</param>
public sealed record OrderItemRequest(Guid? ProductTypeId, string? Description, string? SizeVariant, int? Quantity, decimal? UnitPrice) : IOrderItemFields;

/// <summary>One discount of the New Order form (D-15, D-24, ORD-05).</summary>
/// <param name="Kind">The kind: <c>fixed</c> or <c>percentage</c>.</param>
/// <param name="Value">The peso amount (fixed) or the percent (percentage).</param>
/// <param name="Reason">Why the discount is given.</param>
public sealed record OrderDiscountRequest(string? Kind, decimal? Value, string? Reason) : IOrderDiscountFields;

/// <summary>One payment of the New Order form (ORD-03, ORD-05, ORD-22).</summary>
/// <param name="PaymentDate">The day the money was received, <c>yyyy-MM-dd</c>.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="PaymentMethodId">The payment method.</param>
/// <param name="Reference">The reference, such as a transfer number.</param>
/// <param name="Notes">Free notes.</param>
/// <param name="ReceivedByUserId">The staff member who received the money.</param>
public sealed record OrderPaymentRequest(
    string? PaymentDate,
    decimal? Amount,
    Guid? PaymentMethodId,
    string? Reference,
    string? Notes,
    Guid? ReceivedByUserId) : IOrderPaymentFields;
