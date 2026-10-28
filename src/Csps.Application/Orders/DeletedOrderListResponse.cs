using Csps.Application.Users;

namespace Csps.Application.Orders;

/// <summary>One deleted order in the deleted list (D-28). It carries no contact details, address or notes.</summary>
/// <param name="Id">The order id.</param>
/// <param name="Number">The order number.</param>
/// <param name="CustomerName">The customer's name.</param>
/// <param name="TeamName">The team or club name; null when none.</param>
/// <param name="Status">The status key the order had when it was deleted.</param>
/// <param name="Total">The order total in pesos.</param>
/// <param name="Paid">What was paid in pesos.</param>
/// <param name="Balance">The balance in pesos.</param>
/// <param name="DeletedAt">When it was deleted.</param>
/// <param name="DeletedBy">Who deleted it; null reads as System.</param>
public sealed record DeletedOrderListItem(
    Guid Id,
    string Number,
    string CustomerName,
    string? TeamName,
    string Status,
    decimal Total,
    decimal Paid,
    decimal Balance,
    DateTimeOffset DeletedAt,
    ActorRef? DeletedBy);

/// <summary>One page of the deleted list (D-28).</summary>
/// <param name="Items">The rows of this page.</param>
/// <param name="Total">How many deleted orders there are, across all pages.</param>
/// <param name="Page">The page number asked for.</param>
/// <param name="PageSize">The page size asked for.</param>
public sealed record DeletedOrderListResponse(IReadOnlyList<DeletedOrderListItem> Items, int Total, int Page, int PageSize);
