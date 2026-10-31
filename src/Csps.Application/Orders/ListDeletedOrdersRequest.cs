namespace Csps.Application.Orders;

/// <summary>The deleted-order list query (D-28). Every part is optional.</summary>
/// <param name="Page">The page number, from 1.</param>
/// <param name="PageSize">Rows per page, from 1 to 100.</param>
public sealed record ListDeletedOrdersRequest(int Page = 1, int PageSize = ListDeletedOrdersRequest.DefaultPageSize)
{
    /// <summary>The page size when none is sent.</summary>
    public const int DefaultPageSize = 20;
}
