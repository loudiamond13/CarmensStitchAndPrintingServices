namespace Csps.Application.Ports;

/// <summary>Read access to the company expense categories (D-08). Application never sees EF: the implementation maps to these records.</summary>
public interface IExpenseCategories
{
    /// <summary>Lists every category, retired ones included, A to Z with Others last, then by id (D-15).</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The categories in display order.</returns>
    Task<IReadOnlyList<ExpenseCategoryView>> ListAsync(CancellationToken cancellationToken);

    /// <summary>Reads one category's name and retired flag, so a new expense can be refused a retired or unknown category (D-11).</summary>
    /// <param name="id">The category id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The state, or null when no such category exists.</returns>
    Task<ExpenseCategoryState?> GetStateAsync(Guid id, CancellationToken cancellationToken);
}

/// <summary>One category's id, name and retired flag.</summary>
/// <param name="Id">The category id.</param>
/// <param name="Name">The display name.</param>
/// <param name="Retired">True once the category is retired (D-11).</param>
public sealed record ExpenseCategoryState(Guid Id, string Name, bool Retired);

/// <summary>One expense category as the read port returns it.</summary>
/// <param name="Id">The category id.</param>
/// <param name="Name">The display name.</param>
/// <param name="Tone">One of the six colour tones.</param>
/// <param name="Retired">True once the category is retired (D-11).</param>
/// <param name="IsOthers">True for the catch-all Others category.</param>
public sealed record ExpenseCategoryView(Guid Id, string Name, string Tone, bool Retired, bool IsOthers);
