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

    /// <summary>
    /// Reads one page of soft-deleted expenses, most recently deleted first and then by id, and the count over every page of the same
    /// filter, in two SQL commands (D-07). Live expenses are never listed.
    /// </summary>
    /// <param name="query">The filters and page, already validated.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The rows of the page and the total count.</returns>
    Task<DeletedExpensePage> ListDeletedAsync(DeletedExpenseListQuery query, CancellationToken cancellationToken);

    /// <summary>
    /// Reads the month figures for the KPI row in two SQL commands: this month and last month together, then this month by category.
    /// Expenses count by their date, upcoming ones included; soft-deleted expenses never count (D-01, D-24).
    /// </summary>
    /// <param name="months">The first and last day of this month and of last month.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The totals and counts of both months and this month's top category.</returns>
    Task<ExpenseKpiTotals> GetKpisAsync(KpiMonths months, CancellationToken cancellationToken);
}

/// <summary>The two months the KPI row covers, as first and last days in the business zone.</summary>
/// <param name="ThisFirst">The first day of this month.</param>
/// <param name="ThisLast">The last day of this month.</param>
/// <param name="LastFirst">The first day of last month.</param>
/// <param name="LastLast">The last day of last month.</param>
public sealed record KpiMonths(DateOnly ThisFirst, DateOnly ThisLast, DateOnly LastFirst, DateOnly LastLast);

/// <summary>The month figures the read port returns for the KPI row.</summary>
/// <param name="ThisMonthTotal">The sum of this month's expenses; 0.00 when none.</param>
/// <param name="ThisMonthCount">How many expenses this month.</param>
/// <param name="LastMonthTotal">The sum of last month's expenses; 0.00 when none.</param>
/// <param name="LastMonthCount">How many expenses last month.</param>
/// <param name="TopCategory">The category with the highest total this month, ties to the name first A to Z; null when there is none.</param>
/// <param name="TopTotal">The top category's total this month; 0.00 when there is none.</param>
public sealed record ExpenseKpiTotals(
    decimal ThisMonthTotal,
    int ThisMonthCount,
    decimal LastMonthTotal,
    int LastMonthCount,
    ExpenseCategoryRef? TopCategory,
    decimal TopTotal);

/// <summary>A checked list query for the read port.</summary>
/// <param name="From">The first expense date, included.</param>
/// <param name="To">The last expense date, included.</param>
/// <param name="CategoryId">Only this category; null means all.</param>
/// <param name="Search">Text to find in the description or the payer's or recorder's name; null means no search.</param>
/// <param name="Page">The page number, from 1.</param>
/// <param name="PageSize">Rows per page, from 1 to 100.</param>
public sealed record CompanyExpenseListQuery(DateOnly From, DateOnly To, Guid? CategoryId, string? Search, int Page, int PageSize);

/// <summary>A checked query for the deleted-expense list.</summary>
/// <param name="CategoryId">Only this category; null means all.</param>
/// <param name="Search">Text to find in the description or the payer's or recorder's name; null means no search.</param>
/// <param name="Page">The page number, from 1.</param>
/// <param name="PageSize">Rows per page, from 1 to 100.</param>
public sealed record DeletedExpenseListQuery(Guid? CategoryId, string? Search, int Page, int PageSize);

/// <summary>One row of the deleted-expense list as the read port returns it. It carries no notes (D-19).</summary>
/// <param name="Id">The expense id.</param>
/// <param name="DeletedAtUtc">When it was deleted.</param>
/// <param name="DeletedBy">Who deleted it; null reads as System.</param>
/// <param name="Date">The day the money was spent.</param>
/// <param name="Category">The category.</param>
/// <param name="Description">What it was for.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="PaidBy">The payer, with the former-staff flag.</param>
public sealed record DeletedExpenseRow(
    Guid Id,
    DateTimeOffset DeletedAtUtc,
    ActorRef? DeletedBy,
    DateOnly Date,
    ExpenseCategoryRef Category,
    string Description,
    decimal Amount,
    ActorRef PaidBy);

/// <summary>One page of the deleted-expense list.</summary>
/// <param name="Items">The rows of this page.</param>
/// <param name="Total">How many deleted expenses match, across all pages.</param>
public sealed record DeletedExpensePage(IReadOnlyList<DeletedExpenseRow> Items, int Total);

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
