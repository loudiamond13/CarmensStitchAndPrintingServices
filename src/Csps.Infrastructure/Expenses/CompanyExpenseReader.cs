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
    private const string SoftDeleteFilter = "SoftDelete";

    // The detail and both KPI reads have a fixed shape and run on every page load, so they are compiled once (PERF-04). The list is
    // not: its optional filters change the shape, and EF caches the plan of each shape.
    //
    // The named SoftDelete filter hides a deleted expense. The payer, recorder and last changer come from their own user rows, so a
    // rename shows at once and a deleted person keeps their name (D-08, D-11).
    private static readonly Func<CspsDbContext, Guid, CancellationToken, Task<DetailRow?>> DetailQuery = EF.CompileAsyncQuery(
        (CspsDbContext db, Guid id, CancellationToken _) =>
            (from expense in db.CompanyExpenses.AsNoTracking()
             where expense.Id == id
             join category in db.ExpenseCategories on expense.CategoryId equals category.Id
             join payer in db.Users on expense.PaidByUserId equals payer.Id
             join recorderUser in db.Users on expense.CreatedById equals (Guid?)recorderUser.Id into recorders
             from recorder in recorders.DefaultIfEmpty()
             join changerUser in db.Users on expense.UpdatedById equals (Guid?)changerUser.Id into changers
             from changer in changers.DefaultIfEmpty()
             select new DetailRow
             {
                 Id = expense.Id,
                 ExpenseDate = expense.ExpenseDate,
                 CategoryId = expense.CategoryId,
                 Description = expense.Description,
                 Amount = expense.Amount,
                 Notes = expense.Notes,
                 PaidByUserId = expense.PaidByUserId,
                 CreatedById = expense.CreatedById,
                 CreatedAtUtc = expense.CreatedAtUtc,
                 UpdatedAtUtc = expense.UpdatedAtUtc,
                 RowVersion = expense.RowVersion,
                 CategoryName = category.Name,
                 CategoryTone = category.Tone,
                 CategoryRetired = category.RetiredAtUtc != null,
                 PayerFirst = payer.FirstName,
                 PayerLast = payer.LastName,
                 PayerFormer = payer.DeletedAtUtc != null,

                 // D-32, D-49: the same set as StaffState.CanPay (a password and the first sign-in mark), evaluated in SQL.
                 // Keep in step with StaffDirectory and the dev seed.
                 PayerActive = payer.IsActive
                     && payer.ManagerLockedAtUtc == null
                     && payer.DeletedAtUtc == null
                     && payer.PasswordHash != null
                     && payer.EmailConfirmed
                     && db.UserRoles.Any(link => link.UserId == payer.Id && db.Roles.Any(role =>
                         role.Id == link.RoleId && (role.Name == Roles.Admin || role.Name == Roles.Manager))),
                 RecorderFirst = (string?)recorder.FirstName,
                 RecorderLast = (string?)recorder.LastName,
                 RecorderFormer = recorder.DeletedAtUtc != null,
                 ChangerId = (Guid?)changer.Id,
                 ChangerFirst = (string?)changer.FirstName,
                 ChangerLast = (string?)changer.LastName,
                 ChangerFormer = changer.DeletedAtUtc != null,
             })
            .SingleOrDefault());

    // Both months in one grouped read with conditional sums and counts. No row at all means no group, so no result.
    private static readonly Func<CspsDbContext, DateOnly, DateOnly, DateOnly, DateOnly, CancellationToken, Task<KpiFigures?>> KpiFiguresQuery =
        EF.CompileAsyncQuery(
            (CspsDbContext db, DateOnly lastFirst, DateOnly lastLast, DateOnly thisFirst, DateOnly thisLast, CancellationToken _) =>
                db.CompanyExpenses.AsNoTracking()
                    .Where(expense => expense.ExpenseDate >= lastFirst && expense.ExpenseDate <= thisLast)
                    .GroupBy(static _ => 1)
                    .Select(group => new KpiFigures
                    {
                        ThisTotal = group.Sum(expense => expense.ExpenseDate >= thisFirst ? expense.Amount : 0m),
                        ThisCount = group.Count(expense => expense.ExpenseDate >= thisFirst),
                        LastTotal = group.Sum(expense => expense.ExpenseDate <= lastLast ? expense.Amount : 0m),
                        LastCount = group.Count(expense => expense.ExpenseDate <= lastLast),
                    })
                    .SingleOrDefault());

    // This month by category, highest total first, ties to the name first A to Z.
    private static readonly Func<CspsDbContext, DateOnly, DateOnly, CancellationToken, Task<TopCategoryRow?>> TopCategoryQuery =
        EF.CompileAsyncQuery(
            (CspsDbContext db, DateOnly thisFirst, DateOnly thisLast, CancellationToken _) =>
                (from expense in db.CompanyExpenses.AsNoTracking()
                 where expense.ExpenseDate >= thisFirst && expense.ExpenseDate <= thisLast
                 join category in db.ExpenseCategories.AsNoTracking() on expense.CategoryId equals category.Id
                 group expense by new { category.Id, category.Name, category.Tone, Retired = category.RetiredAtUtc != null } into byCategory
                 orderby byCategory.Sum(expense => expense.Amount) descending, byCategory.Key.Name
                 select new TopCategoryRow
                 {
                     Id = byCategory.Key.Id,
                     Name = byCategory.Key.Name,
                     Tone = byCategory.Key.Tone,
                     Retired = byCategory.Key.Retired,
                     Total = byCategory.Sum(expense => expense.Amount),
                 })
                .FirstOrDefault());

    public async Task<CompanyExpenseDetailView?> GetDetailAsync(Guid id, CancellationToken cancellationToken)
    {
        var row = await DetailQuery(context, id, cancellationToken).ConfigureAwait(false);

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

    public async Task<DeletedExpensePage> ListDeletedAsync(DeletedExpenseListQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        // The named SoftDelete filter is lifted for this read only, and only deleted rows are kept.
        var matches = Narrow(
            context.CompanyExpenses.IgnoreQueryFilters([SoftDeleteFilter]).AsNoTracking().Where(expense => expense.DeletedAtUtc != null),
            query.CategoryId,
            query.Search);

        // Command 1: the count over every page. Command 2: the page, most recently deleted first, ending on the id so paging is stable.
        var total = await matches.CountAsync(cancellationToken).ConfigureAwait(false);
        var rows = await (
            from expense in matches
            join category in context.ExpenseCategories.AsNoTracking() on expense.CategoryId equals category.Id
            join payer in context.Users.AsNoTracking() on expense.PaidByUserId equals payer.Id
            join deleterUser in context.Users.AsNoTracking() on expense.DeletedById equals (Guid?)deleterUser.Id into deleters
            from deleter in deleters.DefaultIfEmpty()
            orderby expense.DeletedAtUtc descending, expense.Id descending
            select new
            {
                expense.Id,
                DeletedAtUtc = expense.DeletedAtUtc!.Value,
                expense.DeletedById,
                expense.ExpenseDate,
                expense.CategoryId,
                expense.Description,
                expense.Amount,
                expense.PaidByUserId,
                CategoryName = category.Name,
                CategoryTone = category.Tone,
                CategoryRetired = category.RetiredAtUtc != null,
                PayerFirst = payer.FirstName,
                PayerLast = payer.LastName,
                PayerFormer = payer.DeletedAtUtc != null,
                DeleterFirst = (string?)deleter.FirstName,
                DeleterLast = (string?)deleter.LastName,
                DeleterFormer = deleter.DeletedAtUtc != null,
            })
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        IReadOnlyList<DeletedExpenseRow> items =
        [
            .. rows.Select(row => new DeletedExpenseRow(
                row.Id,
                row.DeletedAtUtc,
                row.DeletedById is { } deletedBy && row.DeleterFirst is not null
                    ? new ActorRef(deletedBy, $"{row.DeleterFirst} {row.DeleterLast}", row.DeleterFormer)
                    : null,
                row.ExpenseDate,
                new ExpenseCategoryRef(row.CategoryId, row.CategoryName, row.CategoryTone, row.CategoryRetired),
                row.Description,
                row.Amount,
                new ActorRef(row.PaidByUserId, $"{row.PayerFirst} {row.PayerLast}", row.PayerFormer))),
        ];
        return new DeletedExpensePage(items, total);
    }

    public async Task<ExpenseKpiTotals> GetKpisAsync(KpiMonths months, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(months);

        // Command 1: both months. Command 2: this month by category.
        var figures = await KpiFiguresQuery(context, months.LastFirst, months.LastLast, months.ThisFirst, months.ThisLast, cancellationToken)
            .ConfigureAwait(false);
        var top = await TopCategoryQuery(context, months.ThisFirst, months.ThisLast, cancellationToken).ConfigureAwait(false);

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
        return Narrow(expenses.Where(expense => expense.ExpenseDate >= query.From && expense.ExpenseDate <= query.To), query.CategoryId, query.Search);
    }

    // The optional category and search, shared by the live list and the deleted list.
    private IQueryable<CompanyExpense> Narrow(IQueryable<CompanyExpense> expenses, Guid? categoryFilter, string? searchText)
    {
        if (categoryFilter is { } categoryId)
        {
            expenses = expenses.Where(expense => expense.CategoryId == categoryId);
        }

        if (searchText is { } search)
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

    private sealed class DetailRow
    {
        public Guid Id { get; init; }

        public DateOnly ExpenseDate { get; init; }

        public Guid CategoryId { get; init; }

        public string Description { get; init; } = string.Empty;

        public decimal Amount { get; init; }

        public string? Notes { get; init; }

        public Guid PaidByUserId { get; init; }

        public Guid? CreatedById { get; init; }

        public DateTimeOffset CreatedAtUtc { get; init; }

        public DateTimeOffset? UpdatedAtUtc { get; init; }

        public byte[] RowVersion { get; init; } = [];

        public string CategoryName { get; init; } = string.Empty;

        public string CategoryTone { get; init; } = string.Empty;

        public bool CategoryRetired { get; init; }

        public string PayerFirst { get; init; } = string.Empty;

        public string PayerLast { get; init; } = string.Empty;

        public bool PayerFormer { get; init; }

        public bool PayerActive { get; init; }

        public string? RecorderFirst { get; init; }

        public string? RecorderLast { get; init; }

        public bool RecorderFormer { get; init; }

        public Guid? ChangerId { get; init; }

        public string? ChangerFirst { get; init; }

        public string? ChangerLast { get; init; }

        public bool ChangerFormer { get; init; }
    }

    private sealed class KpiFigures
    {
        public decimal ThisTotal { get; init; }

        public int ThisCount { get; init; }

        public decimal LastTotal { get; init; }

        public int LastCount { get; init; }
    }

    private sealed class TopCategoryRow
    {
        public Guid Id { get; init; }

        public string Name { get; init; } = string.Empty;

        public string Tone { get; init; } = string.Empty;

        public bool Retired { get; init; }

        public decimal Total { get; init; }
    }
}
