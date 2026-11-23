namespace Csps.Application.QuoteRequests;

/// <summary>The staff inbox query (INQ-05, D-18). Every part is optional.</summary>
/// <param name="Status">One of <c>open</c> (the default: New, Contacted, Quoted), <c>converted</c>, <c>closed</c>, <c>spam</c> or <c>all</c>.</param>
/// <param name="Q">Search text for the name, team or phone digits; blank means no search.</param>
/// <param name="Page">The page number, from 1.</param>
/// <param name="Size">Rows per page: 10, 20, 50 or 100.</param>
public sealed record ListQuoteRequestsRequest(
    string? Status = null,
    string? Q = null,
    int Page = 1,
    int Size = ListQuoteRequestsRequest.DefaultSize)
{
    /// <summary>The page size used when the caller sends none.</summary>
    public const int DefaultSize = 20;
}
