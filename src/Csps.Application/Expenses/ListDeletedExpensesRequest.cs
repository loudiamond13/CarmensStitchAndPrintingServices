namespace Csps.Application.Expenses;

/// <summary>The deleted-expense list query (D-07). Every part is optional.</summary>
/// <param name="Q">Search text for the description or a person's name; blank means no search. Notes are never searched (D-19).</param>
/// <param name="Category">A category id; none means all.</param>
/// <param name="Page">The page number, from 1.</param>
/// <param name="PageSize">Rows per page, from 1 to 100.</param>
public sealed record ListDeletedExpensesRequest(
    string? Q = null,
    string? Category = null,
    int Page = 1,
    int PageSize = ListCompanyExpensesRequest.DefaultPageSize);
