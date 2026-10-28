namespace Csps.Application.Orders;

/// <summary>The order list query (ORD-01, ORD-02). Every part is optional; the dates come as <c>yyyy-MM-dd</c> text.</summary>
/// <param name="Q">Search text for the number, customer name, team or contact number; blank means no search.</param>
/// <param name="Status">One of <c>active</c> (the default), <c>all</c> or a status key such as <c>production</c>.</param>
/// <param name="From">The first order date to keep.</param>
/// <param name="To">The last order date to keep; not before <paramref name="From"/>.</param>
/// <param name="ProductType">A product type id; keeps orders with at least one item of that type.</param>
/// <param name="HasBalance">True to keep only orders that still owe money.</param>
/// <param name="Sort">One of <c>due</c> (the default), <c>newest</c>, <c>balance</c> or <c>total</c>.</param>
/// <param name="Page">The page number, from 1.</param>
/// <param name="PageSize">Rows per page, from 1 to 100.</param>
public sealed record ListOrdersRequest(
    string? Q = null,
    string? Status = null,
    string? From = null,
    string? To = null,
    string? ProductType = null,
    bool? HasBalance = null,
    string? Sort = null,
    int Page = 1,
    int PageSize = ListOrdersRequest.DefaultPageSize)
{
    /// <summary>The page size used when the caller sends none.</summary>
    public const int DefaultPageSize = 20;
}
