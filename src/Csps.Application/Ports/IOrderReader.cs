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
}

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
