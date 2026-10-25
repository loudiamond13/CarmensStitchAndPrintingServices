using Csps.Application.Ports;
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
