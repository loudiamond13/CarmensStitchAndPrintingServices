using Csps.Application.Expenses;
using Csps.Application.Users;

namespace Csps.Application.Ports;

/// <summary>Read access to company expenses. Application never sees EF: the implementation maps to these records.</summary>
public interface ICompanyExpenseReader
{
    /// <summary>Reads one expense with its category, payer, recorder and last changer. A soft-deleted expense is not found.</summary>
    /// <param name="id">The expense id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The detail, or null when no live expense has that id.</returns>
    Task<CompanyExpenseDetailView?> GetDetailAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    /// Reads one page of live expenses and the count and sum over every page of the same filter, in two SQL commands whatever the
    /// page size (PERF-04). Soft-deleted expenses are never counted or listed (D-01).
    /// </summary>
    /// <param name="query">The window, filters and page, already validated.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The rows of the page, the total count and the period total.</returns>
    Task<CompanyExpenseListPage> ListAsync(CompanyExpenseListQuery query, CancellationToken cancellationToken);
}

/// <summary>A checked list query for the read port.</summary>
/// <param name="From">The first expense date, included.</param>
/// <param name="To">The last expense date, included.</param>
/// <param name="CategoryId">Only this category; null means all.</param>
/// <param name="Search">Text to find in the description or the payer's or recorder's name; null means no search.</param>
/// <param name="Page">The page number, from 1.</param>
/// <param name="PageSize">Rows per page, from 1 to 100.</param>
public sealed record CompanyExpenseListQuery(DateOnly From, DateOnly To, Guid? CategoryId, string? Search, int Page, int PageSize);

/// <summary>One row of the expense list as the read port returns it. It carries no notes (D-19).</summary>
/// <param name="Id">The expense id.</param>
/// <param name="Date">The day the money was spent.</param>
/// <param name="Category">The category.</param>
/// <param name="Description">What it was for.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="PaidBy">The payer, with the former-staff flag.</param>
/// <param name="RecordedBy">The creator; null reads as System.</param>
/// <param name="CreatedById">The creator's id, for the edit rule; null reads as System.</param>
/// <param name="PaidByUserId">The payer's id, for the edit rule.</param>
public sealed record CompanyExpenseListRow(
    Guid Id,
    DateOnly Date,
    ExpenseCategoryRef Category,
    string Description,
    decimal Amount,
    ActorRef PaidBy,
    ActorRef? RecordedBy,
    Guid? CreatedById,
    Guid PaidByUserId);

/// <summary>One page of the expense list with the figures over every page.</summary>
/// <param name="Items">The rows of this page.</param>
/// <param name="Total">How many expenses match, across all pages.</param>
/// <param name="PeriodTotal">The sum of their amounts, across all pages; 0.00 when none match.</param>
public sealed record CompanyExpenseListPage(IReadOnlyList<CompanyExpenseListRow> Items, int Total, decimal PeriodTotal);

/// <summary>One company expense as the read port returns it.</summary>
/// <param name="Id">The expense id.</param>
/// <param name="Date">The day the money was spent.</param>
/// <param name="Category">The category.</param>
/// <param name="Description">What it was for.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="Notes">The notes; null when none.</param>
/// <param name="PaidBy">The payer, with the former-staff flag.</param>
/// <param name="PaidByActive">True while the payer passes the payer rule (D-32).</param>
/// <param name="RecordedBy">The creator; null reads as System.</param>
/// <param name="CreatedAtUtc">When it was recorded.</param>
/// <param name="LastChangedBy">The last editor; null when never edited or System.</param>
/// <param name="UpdatedAtUtc">When it was last changed; null when never.</param>
/// <param name="RowVersion">The row version, eight bytes.</param>
/// <param name="CreatedById">The creator's id, for the edit rule; null reads as System.</param>
/// <param name="PaidByUserId">The payer's id, for the edit rule.</param>
public sealed record CompanyExpenseDetailView(
    Guid Id,
    DateOnly Date,
    ExpenseCategoryRef Category,
    string Description,
    decimal Amount,
    string? Notes,
    ActorRef PaidBy,
    bool PaidByActive,
    ActorRef? RecordedBy,
    DateTimeOffset CreatedAtUtc,
    ActorRef? LastChangedBy,
    DateTimeOffset? UpdatedAtUtc,
    byte[] RowVersion,
    Guid? CreatedById,
    Guid PaidByUserId);
