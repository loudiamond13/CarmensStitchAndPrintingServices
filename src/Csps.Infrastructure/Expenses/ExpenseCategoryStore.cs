using Csps.Application.Ports;
using Csps.Application.Users;
using Csps.Domain.Expenses;
using Csps.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Expenses;

/// <summary><see cref="IExpenseCategories"/> over EF: untracked reads ordered in SQL, tracked rows saved by the unit of work.</summary>
internal sealed class ExpenseCategoryStore(CspsDbContext context) : IExpenseCategories
{
    private const string NameIndex = "IX_ExpenseCategories_NormalizedName";
    private const int UniqueIndexViolation = 2601;
    private const int UniqueConstraintViolation = 2627;

    private static readonly string[] SoftDeleteFilter = ["SoftDelete"];

    public async Task<IReadOnlyList<ExpenseCategoryView>> ListAsync(CancellationToken cancellationToken)
    {
        var othersId = ExpenseCategory.OthersId;
        return await context.ExpenseCategories
            .AsNoTracking()
            .OrderBy(category => category.Id == othersId ? 1 : 0)
            .ThenBy(category => category.Name)
            .ThenBy(category => category.Id)
            .Select(category => new ExpenseCategoryView(
                category.Id,
                category.Name,
                category.Tone,
                category.RetiredAtUtc != null,
                category.Id == othersId,
                context.CompanyExpenses.IgnoreQueryFilters(SoftDeleteFilter).Count(expense => expense.CategoryId == category.Id)))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    public async Task<ExpenseCategoryState?> GetStateAsync(Guid id, CancellationToken cancellationToken) =>
        await context.ExpenseCategories
            .AsNoTracking()
            .Where(category => category.Id == id)
            .Select(category => new ExpenseCategoryState(category.Id, category.Name, category.RetiredAtUtc != null))
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

    public async Task<ExpenseCategory?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        await context.ExpenseCategories.SingleOrDefaultAsync(category => category.Id == id, cancellationToken).ConfigureAwait(false);

    public async Task<ExpenseCategoryDetailView?> GetDetailAsync(Guid id, CancellationToken cancellationToken)
    {
        var othersId = ExpenseCategory.OthersId;

        // The recorder and the last changer come from their own user rows, so a rename shows at once and a deleted person keeps their name.
        var row = await (
            from category in context.ExpenseCategories.AsNoTracking()
            where category.Id == id
            join recorderUser in context.Users on category.CreatedById equals (Guid?)recorderUser.Id into recorders
            from recorder in recorders.DefaultIfEmpty()
            join changerUser in context.Users on category.UpdatedById equals (Guid?)changerUser.Id into changers
            from changer in changers.DefaultIfEmpty()
            select new
            {
                category.Id,
                category.Name,
                category.Tone,
                Retired = category.RetiredAtUtc != null,
                IsOthers = category.Id == othersId,
                ExpenseCount = context.CompanyExpenses.IgnoreQueryFilters(SoftDeleteFilter).Count(expense => expense.CategoryId == category.Id),
                category.CreatedById,
                category.CreatedAtUtc,
                category.UpdatedAtUtc,
                category.RowVersion,
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

        return row is null
            ? null
            : new ExpenseCategoryDetailView(
                row.Id,
                row.Name,
                row.Tone,
                row.Retired,
                row.IsOthers,
                row.ExpenseCount,
                row.CreatedById is { } creator && row.RecorderFirst is not null ? new ActorRef(creator, $"{row.RecorderFirst} {row.RecorderLast}", row.RecorderFormer) : null,
                row.CreatedAtUtc,
                row.ChangerId is { } changed && row.ChangerFirst is not null ? new ActorRef(changed, $"{row.ChangerFirst} {row.ChangerLast}", row.ChangerFormer) : null,
                row.UpdatedAtUtc,
                row.RowVersion);
    }

    public async Task<bool> NameTakenAsync(string normalizedName, Guid? excluding, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(normalizedName);
        return await context.ExpenseCategories
            .AsNoTracking()
            .AnyAsync(category => category.NormalizedName == normalizedName && category.Id != excluding, cancellationToken)
            .ConfigureAwait(false);
    }

    public void Add(ExpenseCategory category)
    {
        ArgumentNullException.ThrowIfNull(category);
        context.ExpenseCategories.Add(category);
    }

    /// <summary>
    /// Turns a failed save into the typed exception the Application understands, or returns null when the failure is not one of
    /// the category constraints: the unique normalized-name index raises <see cref="CategoryNameTakenException"/>.
    /// </summary>
    /// <param name="error">The failed save.</param>
    /// <returns>The typed exception, or null.</returns>
    internal static Exception? TranslateSaveFailure(DbUpdateException error)
    {
        ArgumentNullException.ThrowIfNull(error);

        if (error.InnerException is not SqlException sql)
        {
            return null;
        }

        return sql.Number is UniqueIndexViolation or UniqueConstraintViolation && sql.Message.Contains(NameIndex, StringComparison.Ordinal)
            ? new CategoryNameTakenException()
            : null;
    }
}
