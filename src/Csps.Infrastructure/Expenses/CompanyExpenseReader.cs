using Csps.Application.Expenses;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Users;
using Csps.Domain.Expenses;
using Csps.Infrastructure.Common;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Expenses;

/// <summary><see cref="ICompanyExpenseReader"/> over EF: untracked reads, one statement per read.</summary>
internal sealed class CompanyExpenseReader(CspsDbContext context) : ICompanyExpenseReader
{
    public async Task<CompanyExpenseDetailView?> GetDetailAsync(Guid id, CancellationToken cancellationToken)
    {
        // The named SoftDelete filter hides a deleted expense. The payer, recorder and last changer come from their own
        // user rows, so a rename shows at once and a deleted person keeps their name (D-08, D-11).
        var row = await (
            from expense in context.CompanyExpenses.AsNoTracking()
            where expense.Id == id
            join category in context.ExpenseCategories on expense.CategoryId equals category.Id
            join payer in context.Users on expense.PaidByUserId equals payer.Id
            join recorderUser in context.Users on expense.CreatedById equals (Guid?)recorderUser.Id into recorders
            from recorder in recorders.DefaultIfEmpty()
            join changerUser in context.Users on expense.UpdatedById equals (Guid?)changerUser.Id into changers
            from changer in changers.DefaultIfEmpty()
            select new
            {
                expense.Id,
                expense.ExpenseDate,
                expense.CategoryId,
                expense.Description,
                expense.Amount,
                expense.Notes,
                expense.PaidByUserId,
                expense.CreatedById,
                expense.CreatedAtUtc,
                expense.UpdatedAtUtc,
                expense.RowVersion,
                CategoryName = category.Name,
                CategoryTone = category.Tone,
                CategoryRetired = category.RetiredAtUtc != null,
                PayerFirst = payer.FirstName,
                PayerLast = payer.LastName,
                PayerFormer = payer.DeletedAtUtc != null,

                // D-32, the same set as StaffState.CanPay, evaluated in SQL.
                PayerActive = payer.IsActive
                    && payer.ManagerLockedAtUtc == null
                    && payer.DeletedAtUtc == null
                    && payer.PasswordHash != null
                    && context.UserRoles.Any(link => link.UserId == payer.Id && context.Roles.Any(role =>
                        role.Id == link.RoleId && (role.Name == Roles.Admin || role.Name == Roles.Manager))),
                RecorderFirst = (string?)recorder.FirstName,
                RecorderLast = (string?)recorder.LastName,
                RecorderFormer = recorder.DeletedAtUtc != null,
                ChangerId = (Guid?)changer.Id,
                ChangerFirst = (string?)changer.FirstName,
                ChangerLast = (string?)changer.LastName,
                ChangerFormer = changer.DeletedAtUtc != null,
            })
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (row is null)
        {
            return null;
        }

        return new CompanyExpenseDetailView(
            row.Id,
            row.ExpenseDate,
            new ExpenseCategoryRef(row.CategoryId, row.CategoryName, row.CategoryTone, row.CategoryRetired),
            row.Description,
            row.Amount,
            row.Notes,
            new ActorRef(row.PaidByUserId, $"{row.PayerFirst} {row.PayerLast}", row.PayerFormer),
            row.PayerActive,
            row.CreatedById is { } creator && row.RecorderFirst is not null
                ? new ActorRef(creator, $"{row.RecorderFirst} {row.RecorderLast}", row.RecorderFormer)
                : null,
            row.CreatedAtUtc,
            row.ChangerId is { } changed && row.ChangerFirst is not null
                ? new ActorRef(changed, $"{row.ChangerFirst} {row.ChangerLast}", row.ChangerFormer)
                : null,
            row.UpdatedAtUtc,
            row.RowVersion,
            row.CreatedById,
            row.PaidByUserId);
    }

    public async Task<CompanyExpenseListPage> ListAsync(CompanyExpenseListQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var matches = Filter(context.CompanyExpenses.AsNoTracking(), query);

        // Command 1: the count and the sum over every page of the filter. No row at all means no group, so 0 and 0.00.
        var totals = await matches
            .GroupBy(static _ => 1)
            .Select(static group => new { Count = group.Count(), Sum = group.Sum(expense => expense.Amount) })
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        // Command 2: the page, with the category, payer and recorder read in the same statement. The order ends on the id so
        // paging is stable. A deleted person keeps their name (D-08, D-11).
        var rows = await (
            from expense in matches
            join category in context.ExpenseCategories.AsNoTracking() on expense.CategoryId equals category.Id
            join payer in context.Users.AsNoTracking() on expense.PaidByUserId equals payer.Id
            join recorderUser in context.Users.AsNoTracking() on expense.CreatedById equals (Guid?)recorderUser.Id into recorders
            from recorder in recorders.DefaultIfEmpty()
            orderby expense.ExpenseDate descending, expense.CreatedAtUtc descending, expense.Id descending
            select new
            {
                expense.Id,
                expense.ExpenseDate,
                expense.CategoryId,
                expense.Description,
                expense.Amount,
                expense.PaidByUserId,
                expense.CreatedById,
                CategoryName = category.Name,
                CategoryTone = category.Tone,
                CategoryRetired = category.RetiredAtUtc != null,
                PayerFirst = payer.FirstName,
                PayerLast = payer.LastName,
                PayerFormer = payer.DeletedAtUtc != null,
                RecorderFirst = (string?)recorder.FirstName,
                RecorderLast = (string?)recorder.LastName,
                RecorderFormer = recorder.DeletedAtUtc != null,
            })
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        IReadOnlyList<CompanyExpenseListRow> items =
        [
            .. rows.Select(row => new CompanyExpenseListRow(
                row.Id,
                row.ExpenseDate,
                new ExpenseCategoryRef(row.CategoryId, row.CategoryName, row.CategoryTone, row.CategoryRetired),
                row.Description,
                row.Amount,
                new ActorRef(row.PaidByUserId, $"{row.PayerFirst} {row.PayerLast}", row.PayerFormer),
                row.CreatedById is { } creator && row.RecorderFirst is not null
                    ? new ActorRef(creator, $"{row.RecorderFirst} {row.RecorderLast}", row.RecorderFormer)
                    : null,
                row.CreatedById,
                row.PaidByUserId)),
        ];
        return new CompanyExpenseListPage(items, totals?.Count ?? 0, totals?.Sum ?? 0m);
    }

    public async Task<ExpenseKpiTotals> GetKpisAsync(KpiMonths months, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(months);

        // Command 1: both months in one grouped read with conditional sums and counts. No row at all means no group, so zeros.
        var figures = await context.CompanyExpenses.AsNoTracking()
            .Where(expense => expense.ExpenseDate >= months.LastFirst && expense.ExpenseDate <= months.ThisLast)
            .GroupBy(static _ => 1)
            .Select(group => new
            {
                ThisTotal = group.Sum(expense => expense.ExpenseDate >= months.ThisFirst ? expense.Amount : 0m),
                ThisCount = group.Count(expense => expense.ExpenseDate >= months.ThisFirst),
                LastTotal = group.Sum(expense => expense.ExpenseDate <= months.LastLast ? expense.Amount : 0m),
                LastCount = group.Count(expense => expense.ExpenseDate <= months.LastLast),
            })
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        // Command 2: this month by category, highest total first, ties to the name first A to Z.
        var top = await (
            from expense in context.CompanyExpenses.AsNoTracking()
            where expense.ExpenseDate >= months.ThisFirst && expense.ExpenseDate <= months.ThisLast
            join category in context.ExpenseCategories.AsNoTracking() on expense.CategoryId equals category.Id
            group expense by new { category.Id, category.Name, category.Tone, Retired = category.RetiredAtUtc != null } into byCategory
            orderby byCategory.Sum(expense => expense.Amount) descending, byCategory.Key.Name
            select new
            {
                byCategory.Key.Id,
                byCategory.Key.Name,
                byCategory.Key.Tone,
                byCategory.Key.Retired,
                Total = byCategory.Sum(expense => expense.Amount),
            })
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        return new ExpenseKpiTotals(
            figures?.ThisTotal ?? 0m,
            figures?.ThisCount ?? 0,
            figures?.LastTotal ?? 0m,
            figures?.LastCount ?? 0,
            top is null ? null : new ExpenseCategoryRef(top.Id, top.Name, top.Tone, top.Retired),
            top?.Total ?? 0m);
    }

    // The window, then the optional category and search. The search looks at the description and at the names of the payer and the
    // recorder, never at the notes (D-19). A typed wildcard stays literal (CWE-943).
    private IQueryable<CompanyExpense> Filter(IQueryable<CompanyExpense> expenses, CompanyExpenseListQuery query)
    {
        expenses = expenses.Where(expense => expense.ExpenseDate >= query.From && expense.ExpenseDate <= query.To);

        if (query.CategoryId is { } categoryId)
        {
            expenses = expenses.Where(expense => expense.CategoryId == categoryId);
        }

        if (query.Search is { } search)
        {
            var pattern = LikePattern.Contains(search);
            expenses = expenses.Where(expense =>
                EF.Functions.Like(expense.Description, pattern, LikePattern.EscapeCharacter)
                || context.Users.Any(person =>
                    (person.Id == expense.PaidByUserId || person.Id == expense.CreatedById)
                    && (EF.Functions.Like(person.FirstName, pattern, LikePattern.EscapeCharacter)
                        || EF.Functions.Like(person.LastName, pattern, LikePattern.EscapeCharacter)
                        || EF.Functions.Like(person.FirstName + " " + person.LastName, pattern, LikePattern.EscapeCharacter))));
        }

        return expenses;
    }
}
