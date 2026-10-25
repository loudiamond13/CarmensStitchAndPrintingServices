using Csps.Application.Users;

namespace Csps.Application.Expenses;

/// <summary>One expense in the list. It carries no notes (D-19).</summary>
/// <param name="Id">The expense id.</param>
/// <param name="Date">The day the money was spent.</param>
/// <param name="Category">The category.</param>
/// <param name="Description">What it was for.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="PaidBy">The payer.</param>
/// <param name="RecordedBy">Who recorded it; null reads as System.</param>
/// <param name="CanEdit">True when the caller may edit it (D-26).</param>
public sealed record CompanyExpenseListItem(
    Guid Id,
    DateOnly Date,
    ExpenseCategoryRef Category,
    string Description,
    decimal Amount,
    ActorRef PaidBy,
    ActorRef? RecordedBy,
    bool CanEdit);

/// <summary>One page of the expense list with the figures over every page and the window the server applied.</summary>
/// <param name="Items">The rows of this page.</param>
/// <param name="Total">How many expenses match, across all pages.</param>
/// <param name="Page">The page number asked for.</param>
/// <param name="PageSize">The page size asked for.</param>
/// <param name="PeriodTotal">The sum of the matching amounts across all pages; 0.00 when none match.</param>
/// <param name="From">The first day of the window used.</param>
/// <param name="To">The last day of the window used.</param>
/// <param name="Today">The business today, so the browser never reads the device clock for it.</param>
public sealed record CompanyExpenseListResponse(
    IReadOnlyList<CompanyExpenseListItem> Items,
    int Total,
    int Page,
    int PageSize,
    decimal PeriodTotal,
    DateOnly From,
    DateOnly To,
    DateOnly Today);
