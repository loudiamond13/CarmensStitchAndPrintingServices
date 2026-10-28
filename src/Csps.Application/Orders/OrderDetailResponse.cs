using Csps.Application.Users;

namespace Csps.Application.Orders;

/// <summary>An order list entry an item points at: its name and badge tone, and whether it is retired (D-18).</summary>
/// <param name="Id">The entry id.</param>
/// <param name="Name">The display name.</param>
/// <param name="Tone">One of the six colour tones.</param>
/// <param name="Retired">True once the entry is retired.</param>
public sealed record OrderListRef(Guid Id, string Name, string Tone, bool Retired);

/// <summary>One line of an order.</summary>
/// <param name="Id">The item id.</param>
/// <param name="ProductType">The product type.</param>
/// <param name="Description">What the line is.</param>
/// <param name="SizeVariant">The size or variant; null when none.</param>
/// <param name="Quantity">How many.</param>
/// <param name="UnitPrice">The price of one, in pesos.</param>
/// <param name="LineTotal">The quantity times the unit price.</param>
public sealed record OrderItemResponse(Guid Id, OrderListRef ProductType, string Description, string? SizeVariant, int Quantity, decimal UnitPrice, decimal LineTotal);

/// <summary>One discount of an order (D-15, ORD-05).</summary>
/// <param name="Id">The discount id.</param>
/// <param name="Kind">The kind key: fixed or percentage.</param>
/// <param name="Value">The peso amount (fixed) or the percent (percentage).</param>
/// <param name="Reason">Why the discount was given.</param>
/// <param name="RecordedBy">Who added it; null reads as System.</param>
/// <param name="RecordedAt">When it was added.</param>
/// <param name="LastChangedBy">Who last changed it; null until an edit.</param>
/// <param name="LastChangedAt">When it was last changed; null until an edit.</param>
public sealed record OrderDiscountResponse(
    Guid Id,
    string Kind,
    decimal Value,
    string Reason,
    ActorRef? RecordedBy,
    DateTimeOffset RecordedAt,
    ActorRef? LastChangedBy,
    DateTimeOffset? LastChangedAt);

/// <summary>One payment of an order (ORD-05, ORD-22). Received by is who holds the money; recorded by is who typed the payment in.</summary>
/// <param name="Id">The payment id.</param>
/// <param name="PaymentDate">The day the money was received.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="Method">The payment method, with its tone and whether it is retired.</param>
/// <param name="Reference">The reference, such as a transfer number; null when none.</param>
/// <param name="Notes">The notes; null when none.</param>
/// <param name="ReceivedBy">The staff member who received the money; the name is kept for a deleted person.</param>
/// <param name="ReceivedByActive">True while the receiver can still be chosen (ORD-22, D-32).</param>
/// <param name="RecordedBy">Who added it; null reads as System.</param>
/// <param name="RecordedAt">When it was added.</param>
/// <param name="LastChangedBy">Who last changed it; null until an edit.</param>
/// <param name="LastChangedAt">When it was last changed; null until an edit.</param>
public sealed record OrderPaymentResponse(
    Guid Id,
    DateOnly PaymentDate,
    decimal Amount,
    OrderListRef Method,
    string? Reference,
    string? Notes,
    ActorRef ReceivedBy,
    bool ReceivedByActive,
    ActorRef? RecordedBy,
    DateTimeOffset RecordedAt,
    ActorRef? LastChangedBy,
    DateTimeOffset? LastChangedAt);

/// <summary>One refund (ORD-18, D-07). Refunded by is who handed the money back; recorded by is who typed the refund in.</summary>
/// <param name="Id">The refund id.</param>
/// <param name="RefundDate">The day the money was handed back.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="Reason">The short reason.</param>
/// <param name="RefundedBy">The staff member who handed the money back; the name is kept for a deleted person.</param>
/// <param name="RefundedByActive">True while the refunder can still be chosen (D-07, D-32).</param>
/// <param name="RecordedBy">Who added it; null reads as System.</param>
/// <param name="RecordedAt">When it was added.</param>
/// <param name="LastChangedBy">Who last changed it; null until an edit.</param>
/// <param name="LastChangedAt">When it was last changed; null until an edit.</param>
public sealed record OrderRefundResponse(
    Guid Id,
    DateOnly RefundDate,
    decimal Amount,
    string Reason,
    ActorRef RefundedBy,
    bool RefundedByActive,
    ActorRef? RecordedBy,
    DateTimeOffset RecordedAt,
    ActorRef? LastChangedBy,
    DateTimeOffset? LastChangedAt);

/// <summary>One order expense (ORD-05, ORD-23). Paid by is who spent the money; recorded by is who typed the expense in.</summary>
/// <param name="Id">The expense id.</param>
/// <param name="ExpenseDate">The day of the expense.</param>
/// <param name="Category">The order expense category, with its tone and whether it is retired.</param>
/// <param name="Description">The description; null when none.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="PaidBy">The staff member who paid; the name is kept for a deleted person.</param>
/// <param name="PaidByActive">True while the payer can still be chosen (ORD-23, D-32).</param>
/// <param name="RecordedBy">Who added it; null reads as System.</param>
/// <param name="RecordedAt">When it was added.</param>
/// <param name="LastChangedBy">Who last changed it; null until an edit.</param>
/// <param name="LastChangedAt">When it was last changed; null until an edit.</param>
public sealed record OrderExpenseResponse(
    Guid Id,
    DateOnly ExpenseDate,
    OrderListRef Category,
    string? Description,
    decimal Amount,
    ActorRef PaidBy,
    bool PaidByActive,
    ActorRef? RecordedBy,
    DateTimeOffset RecordedAt,
    ActorRef? LastChangedBy,
    DateTimeOffset? LastChangedAt);

/// <summary>One row of the status history (ORD-16, D-06).</summary>
/// <param name="From">The status the order left; null for the first row.</param>
/// <param name="To">The status the order entered.</param>
/// <param name="ChangedBy">Who moved it; null reads as System.</param>
/// <param name="ChangedAt">When it moved.</param>
public sealed record OrderStatusChangeResponse(string? From, string To, ActorRef? ChangedBy, DateTimeOffset ChangedAt);

/// <summary>
/// The money figures of an order, read straight from the stored snapshot (ORD-20). Subtotal is before discount, total is after
/// discount, balance is total minus paid plus refunded, and customerCredit is what the shop owes the customer.
/// </summary>
/// <param name="Subtotal">The sum of the line totals.</param>
/// <param name="Discount">The sum of the discounts.</param>
/// <param name="Total">The subtotal minus the discount.</param>
/// <param name="Paid">The sum of the payments.</param>
/// <param name="Refunded">The sum of the refunds.</param>
/// <param name="Balance">The total minus paid plus refunded.</param>
/// <param name="CustomerCredit">What the shop owes the customer; 0.00 when nothing.</param>
/// <param name="Expenses">The sum of the order expenses.</param>
/// <param name="Profit">The profit.</param>
/// <param name="FullyPaid">True when the subtotal is above zero and the balance is zero or less.</param>
public sealed record OrderTotalsResponse(
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

/// <summary>One order with its items, history, totals and who recorded and last changed it (ORD-03).</summary>
/// <param name="Id">The order id.</param>
/// <param name="Number">The order number, <c>ORD-{YYYY}-{NNNN}</c>.</param>
/// <param name="CustomerName">The customer's name.</param>
/// <param name="TeamName">The team name; null when none.</param>
/// <param name="ContactNumber">The contact number.</param>
/// <param name="Email">The email address; null when none.</param>
/// <param name="Address">The address; null when none.</param>
/// <param name="OrderDate">The day the order was taken.</param>
/// <param name="DueDate">The day it is due.</param>
/// <param name="Status">The status key: pending, mockup, production, ready, delivered, completed or cancelled.</param>
/// <param name="StatusChangedAt">When the status last changed.</param>
/// <param name="Notes">The notes; null when none.</param>
/// <param name="Items">The lines, in order.</param>
/// <param name="Discounts">The discounts, in the order they were added.</param>
/// <param name="Payments">The payments, oldest payment date first.</param>
/// <param name="Refunds">The refunds, oldest refund date first.</param>
/// <param name="Expenses">The order expenses, oldest expense date first.</param>
/// <param name="StatusHistory">The status history, oldest first.</param>
/// <param name="Totals">The money figures.</param>
/// <param name="RecordedBy">Who created it; null reads as System.</param>
/// <param name="RecordedAt">When it was created.</param>
/// <param name="LastChangedBy">Who last changed it; null until an edit.</param>
/// <param name="LastChangedAt">When it was last changed; null until an edit.</param>
/// <param name="Version">The base64 of the eight-byte row version a save must send back.</param>
public sealed record OrderDetailResponse(
    Guid Id,
    string Number,
    string CustomerName,
    string? TeamName,
    string? ContactNumber,
    string? Email,
    string? Address,
    DateOnly OrderDate,
    DateOnly? DueDate,
    string Status,
    DateTimeOffset StatusChangedAt,
    string? Notes,
    IReadOnlyList<OrderItemResponse> Items,
    IReadOnlyList<OrderDiscountResponse> Discounts,
    IReadOnlyList<OrderPaymentResponse> Payments,
    IReadOnlyList<OrderRefundResponse> Refunds,
    IReadOnlyList<OrderExpenseResponse> Expenses,
    IReadOnlyList<OrderStatusChangeResponse> StatusHistory,
    OrderTotalsResponse Totals,
    ActorRef? RecordedBy,
    DateTimeOffset RecordedAt,
    ActorRef? LastChangedBy,
    DateTimeOffset? LastChangedAt,
    string Version);
