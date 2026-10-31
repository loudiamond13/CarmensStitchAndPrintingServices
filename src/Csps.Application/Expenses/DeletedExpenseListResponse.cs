using Csps.Application.Users;

namespace Csps.Application.Expenses;

/// <summary>One deleted expense in the deleted list. It carries no notes (D-19).</summary>
/// <param name="Id">The expense id.</param>
/// <param name="DeletedAt">When it was deleted.</param>
/// <param name="DeletedBy">Who deleted it; null reads as System.</param>
/// <param name="Date">The day the money was spent.</param>
/// <param name="Category">The category.</param>
/// <param name="Description">What it was for.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="PaidBy">The payer.</param>
public sealed record DeletedExpenseListItem(
    Guid Id,
    DateTimeOffset DeletedAt,
    ActorRef? DeletedBy,
    DateOnly Date,
    ExpenseCategoryRef Category,
    string Description,
    decimal Amount,
    ActorRef PaidBy);

/// <summary>One page of the deleted list (D-07). There is no period total.</summary>
/// <param name="Items">The rows of this page.</param>
/// <param name="Total">How many deleted expenses match, across all pages.</param>
/// <param name="Page">The page number asked for.</param>
/// <param name="PageSize">The page size asked for.</param>
public sealed record DeletedExpenseListResponse(IReadOnlyList<DeletedExpenseListItem> Items, int Total, int Page, int PageSize);
