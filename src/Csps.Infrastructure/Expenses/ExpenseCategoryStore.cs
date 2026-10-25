using Csps.Application.Ports;
using Csps.Domain.Expenses;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Expenses;

/// <summary><see cref="IExpenseCategories"/> over EF: untracked reads, ordered in SQL.</summary>
internal sealed class ExpenseCategoryStore(CspsDbContext context) : IExpenseCategories
{
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
                category.Id == othersId))
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
}
