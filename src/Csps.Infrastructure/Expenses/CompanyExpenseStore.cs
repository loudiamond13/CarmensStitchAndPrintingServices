using Csps.Application.Ports;
using Csps.Domain.Expenses;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Expenses;

/// <summary><see cref="ICompanyExpenses"/> over EF: tracked rows, saved by the unit of work.</summary>
internal sealed class CompanyExpenseStore(CspsDbContext context) : ICompanyExpenses
{
    private const string SoftDeleteFilter = "SoftDelete";

    public void Add(CompanyExpense expense)
    {
        ArgumentNullException.ThrowIfNull(expense);
        context.CompanyExpenses.Add(expense);
    }

    public async Task<CompanyExpense?> FindAsync(Guid id, bool includeDeleted, CancellationToken cancellationToken)
    {
        var query = includeDeleted
            ? context.CompanyExpenses.IgnoreQueryFilters([SoftDeleteFilter])
            : context.CompanyExpenses.AsQueryable();
        return await query.SingleOrDefaultAsync(expense => expense.Id == id, cancellationToken).ConfigureAwait(false);
    }
}
