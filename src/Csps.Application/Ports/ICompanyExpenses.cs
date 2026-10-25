using Csps.Domain.Expenses;

namespace Csps.Application.Ports;

/// <summary>The tracked store of company expenses: new rows are added and found for change, and saved by <see cref="IUnitOfWork"/>.</summary>
public interface ICompanyExpenses
{
    /// <summary>Adds a new expense to the unit of work. Nothing is saved here.</summary>
    /// <param name="expense">The new expense.</param>
    void Add(CompanyExpense expense);

    /// <summary>Marks an expense for removal from the database in the unit of work (D-04). Nothing is deleted until the unit of work saves.</summary>
    /// <param name="expense">The tracked expense to remove.</param>
    void Remove(CompanyExpense expense);

    /// <summary>Finds one expense for change, tracked.</summary>
    /// <param name="id">The expense id.</param>
    /// <param name="includeDeleted">True to also find a soft-deleted expense (restore and permanent delete).</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The expense, or null when none matches.</returns>
    Task<CompanyExpense?> FindAsync(Guid id, bool includeDeleted, CancellationToken cancellationToken);
}
