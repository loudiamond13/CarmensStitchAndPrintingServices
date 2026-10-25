namespace Csps.Application.Expenses;

/// <summary>The expense list query (CEXP-01). Every part is optional; the dates come as <c>yyyy-MM-dd</c> text and are sent as a pair.</summary>
/// <param name="Q">Search text for the description or a person's name; blank means no search. Notes are never searched (D-19).</param>
/// <param name="Category">A category id; none means all.</param>
/// <param name="From">The first expense date; with <paramref name="To"/> blank, the server uses its default window (D-23).</param>
/// <param name="To">The last expense date; with <paramref name="From"/> blank, the server uses its default window (D-23).</param>
/// <param name="Page">The page number, from 1.</param>
/// <param name="PageSize">Rows per page, from 1 to 100.</param>
public sealed record ListCompanyExpensesRequest(
    string? Q = null,
    string? Category = null,
    string? From = null,
    string? To = null,
    int Page = 1,
    int PageSize = ListCompanyExpensesRequest.DefaultPageSize)
{
    /// <summary>The page size used when the caller sends none.</summary>
    public const int DefaultPageSize = 20;
}
