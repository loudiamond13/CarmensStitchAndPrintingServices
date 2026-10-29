namespace Csps.Application.Orders;

/// <summary>One order in the list (ORD-01). It carries the stored money figures and no contact details, address or notes.</summary>
/// <param name="Id">The order id.</param>
/// <param name="Number">The order number.</param>
/// <param name="CustomerName">The customer's name.</param>
/// <param name="TeamName">The team or club name; null when none.</param>
/// <param name="OrderDate">The day the order was taken.</param>
/// <param name="DueDate">The day it is due; null for an imported order that had none.</param>
/// <param name="Status">The status key.</param>
/// <param name="StatusChangedAt">When the status last changed.</param>
/// <param name="Subtotal">The items total in pesos.</param>
/// <param name="Discount">The discounts total in pesos.</param>
/// <param name="Total">The order total in pesos.</param>
/// <param name="Paid">What was paid in pesos.</param>
/// <param name="Refunded">What was handed back in pesos.</param>
/// <param name="Balance">The balance in pesos.</param>
/// <param name="CustomerCredit">What the shop owes the customer in pesos.</param>
/// <param name="FullyPaid">True when the order is paid in full.</param>
/// <param name="Pieces">How many pieces: the sum of the item quantities.</param>
public sealed record OrderListEntry(
    Guid Id,
    string Number,
    string CustomerName,
    string? TeamName,
    DateOnly OrderDate,
    DateOnly? DueDate,
    string Status,
    DateTimeOffset StatusChangedAt,
    decimal Subtotal,
    decimal Discount,
    decimal Total,
    decimal Paid,
    decimal Refunded,
    decimal Balance,
    decimal CustomerCredit,
    bool FullyPaid,
    int Pieces);

/// <summary>One page of the order list (ORD-01).</summary>
/// <param name="Items">The rows of this page.</param>
/// <param name="Total">How many orders match, across all pages.</param>
/// <param name="Page">The page number asked for.</param>
/// <param name="PageSize">The page size asked for.</param>
/// <param name="AllOrders">Every order that is not deleted, whatever the filters.</param>
/// <param name="ActiveOrders">Orders that are not deleted and are Pending to Delivered, whatever the filters.</param>
/// <param name="Today">The business today, so the browser never reads the device clock for it.</param>
public sealed record OrderListResponse(IReadOnlyList<OrderListEntry> Items, int Total, int Page, int PageSize, int AllOrders, int ActiveOrders, DateOnly Today);
