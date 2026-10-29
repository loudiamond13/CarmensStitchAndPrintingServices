using Csps.Application.Orders;
using Csps.Application.Users;
using Csps.Domain.Orders;

namespace Csps.Application.Ports;

/// <summary>Untracked reads of orders: one order with its items, history and people, shaped for the wire.</summary>
public interface IOrderReader
{
    /// <summary>Reads one order that is not deleted.</summary>
    /// <param name="id">The order id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The order, or null when none exists or it was deleted.</returns>
    Task<OrderDetailResponse?> GetDetailAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    /// Reads one page of soft-deleted orders, most recently deleted first and then by id, and the count over every page, in two SQL
    /// commands whatever the page size (D-28, PERF-04). Live orders are never listed.
    /// </summary>
    /// <param name="page">The page number, from 1.</param>
    /// <param name="pageSize">Rows per page, from 1 to 100.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The rows of the page and the total count.</returns>
    Task<DeletedOrderPage> ListDeletedAsync(int page, int pageSize, CancellationToken cancellationToken);

    /// <summary>
    /// Reads one page of live orders that match the query, in the query's order, the count over every page, and the two list-wide
    /// counts (all orders, active orders) that ignore every filter, in three SQL commands whatever the page size (ORD-01, ORD-02,
    /// PERF-04, D-60). Every figure is a stored column or a sum of item quantities. Deleted orders are never listed or counted.
    /// </summary>
    /// <param name="query">The filters, sort and page.</param>
    /// <param name="now">The current instant, which sets the recent window of the active scope.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The rows of the page, the total count and the two list-wide counts.</returns>
    Task<OrderListPage> ListAsync(OrderListQuery query, DateTimeOffset now, CancellationToken cancellationToken);
}

/// <summary>Which orders the status part of the list keeps.</summary>
public enum OrderListScope
{
    /// <summary>Pending to Delivered, plus Completed and Cancelled orders whose status changed in the last 30 days (the default).</summary>
    Active = 0,

    /// <summary>Every status.</summary>
    All = 1,

    /// <summary>The one status in <see cref="OrderListQuery.Status"/>.</summary>
    One = 2,
}

/// <summary>How the order list is sorted. Every sort ends on the id so paging is stable.</summary>
public enum OrderListSort
{
    /// <summary>Due date, soonest first; orders with no due date last (the default).</summary>
    Due = 0,

    /// <summary>Newest order date first, then newest recorded.</summary>
    Newest = 1,

    /// <summary>Largest balance first.</summary>
    Balance = 2,

    /// <summary>Largest total first.</summary>
    Total = 3,
}

/// <summary>The order list query after the request was checked and its defaults filled in.</summary>
/// <param name="Search">Text to find in the number, customer name, team or contact number; null for no search.</param>
/// <param name="Scope">Which statuses to keep.</param>
/// <param name="Status">The status to keep when <paramref name="Scope"/> is <see cref="OrderListScope.One"/>.</param>
/// <param name="From">The first order date to keep; null for no lower bound.</param>
/// <param name="To">The last order date to keep; null for no upper bound.</param>
/// <param name="ProductTypeId">Keep orders with at least one item of this product type; null for all.</param>
/// <param name="HasBalance">True to keep only orders whose balance is above 0.00.</param>
/// <param name="Sort">The sort.</param>
/// <param name="Page">The page number, from 1.</param>
/// <param name="PageSize">Rows per page, from 1 to 100.</param>
public sealed record OrderListQuery(
    string? Search,
    OrderListScope Scope,
    OrderStatus? Status,
    DateOnly? From,
    DateOnly? To,
    Guid? ProductTypeId,
    bool HasBalance,
    OrderListSort Sort,
    int Page,
    int PageSize);

/// <summary>One row of the order list as the read port returns it: stored figures only, no contact details, address or notes.</summary>
/// <param name="Id">The order id.</param>
/// <param name="Number">The order number.</param>
/// <param name="CustomerName">The customer's name.</param>
/// <param name="TeamName">The team or club name; null when none.</param>
/// <param name="OrderDate">The day the order was taken.</param>
/// <param name="DueDate">The day it is due; null for an imported order that had none.</param>
/// <param name="Status">The status.</param>
/// <param name="StatusChangedAtUtc">When the status last changed.</param>
/// <param name="Subtotal">The items total.</param>
/// <param name="Discount">The discounts total.</param>
/// <param name="Total">The order total.</param>
/// <param name="Paid">What was paid.</param>
/// <param name="Refunded">What was handed back.</param>
/// <param name="Balance">The balance.</param>
/// <param name="CustomerCredit">What the shop owes the customer.</param>
/// <param name="FullyPaid">True when the order is paid in full.</param>
/// <param name="Pieces">How many pieces: the sum of the item quantities.</param>
public sealed record OrderListRow(
    Guid Id,
    string Number,
    string CustomerName,
    string? TeamName,
    DateOnly OrderDate,
    DateOnly? DueDate,
    OrderStatus Status,
    DateTimeOffset StatusChangedAtUtc,
    decimal Subtotal,
    decimal Discount,
    decimal Total,
    decimal Paid,
    decimal Refunded,
    decimal Balance,
    decimal CustomerCredit,
    bool FullyPaid,
    int Pieces);

/// <summary>One page of the order list.</summary>
/// <param name="Items">The rows of this page.</param>
/// <param name="Total">How many orders match, across all pages.</param>
/// <param name="AllOrders">Every order that is not deleted, whatever the filters.</param>
/// <param name="ActiveOrders">Orders that are not deleted and are Pending to Delivered, whatever the filters.</param>
public sealed record OrderListPage(IReadOnlyList<OrderListRow> Items, int Total, int AllOrders, int ActiveOrders);

/// <summary>One row of the deleted-order list as the read port returns it. It carries no contact details, address or notes.</summary>
/// <param name="Id">The order id.</param>
/// <param name="Number">The order number.</param>
/// <param name="CustomerName">The customer's name.</param>
/// <param name="TeamName">The team or club name; null when none.</param>
/// <param name="Status">The status the order had when it was deleted.</param>
/// <param name="Total">The order total.</param>
/// <param name="Paid">What was paid.</param>
/// <param name="Balance">The balance.</param>
/// <param name="DeletedAtUtc">When it was deleted.</param>
/// <param name="DeletedBy">Who deleted it; null reads as System.</param>
public sealed record DeletedOrderRow(
    Guid Id,
    string Number,
    string CustomerName,
    string? TeamName,
    OrderStatus Status,
    decimal Total,
    decimal Paid,
    decimal Balance,
    DateTimeOffset DeletedAtUtc,
    ActorRef? DeletedBy);

/// <summary>One page of the deleted-order list.</summary>
/// <param name="Items">The rows of this page.</param>
/// <param name="Total">How many deleted orders there are, across all pages.</param>
public sealed record DeletedOrderPage(IReadOnlyList<DeletedOrderRow> Items, int Total);
