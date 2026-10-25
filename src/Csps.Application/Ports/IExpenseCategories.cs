using Csps.Application.Users;
using Csps.Domain.Expenses;

namespace Csps.Application.Ports;

/// <summary>Access to the company expense categories (D-08). Application never sees EF: reads map to these records, writes go through tracked rows saved by the unit of work.</summary>
public interface IExpenseCategories
{
    /// <summary>Lists every category, retired ones included, A to Z with Others last, then by id (D-15), each with how many expenses use it, soft-deleted ones included (D-10).</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The categories in display order.</returns>
    Task<IReadOnlyList<ExpenseCategoryView>> ListAsync(CancellationToken cancellationToken);

    /// <summary>Reads one category's name and retired flag, so a new expense can be refused a retired or unknown category (D-11).</summary>
    /// <param name="id">The category id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The state, or null when no such category exists.</returns>
    Task<ExpenseCategoryState?> GetStateAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Loads one category as a tracked row, so a change to it is saved by the unit of work with its row version checked.</summary>
    /// <param name="id">The category id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The category, or null when no such category exists.</returns>
    Task<ExpenseCategory?> FindAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Reads one category with how many expenses use it and who recorded and last changed it. A deleted person keeps their name.</summary>
    /// <param name="id">The category id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The detail, or null when no such category exists.</returns>
    Task<ExpenseCategoryDetailView?> GetDetailAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Counts the expenses that use a category, soft-deleted ones included (D-10, D-30).</summary>
    /// <param name="id">The category id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>How many expense rows point at the category.</returns>
    Task<int> CountExpensesAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Tells whether a category already holds a name, retired ones included (OQ-10).</summary>
    /// <param name="normalizedName">The name as <see cref="ExpenseCategory.Normalize"/> makes it.</param>
    /// <param name="excluding">A category to leave out, so a rename can keep its own name; none when null.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>True when another category holds the name.</returns>
    Task<bool> NameTakenAsync(string normalizedName, Guid? excluding, CancellationToken cancellationToken);

    /// <summary>
    /// Starts tracking a new category. The save that follows throws <see cref="CategoryNameTakenException"/> when another
    /// category took the name first.
    /// </summary>
    /// <param name="category">The new category.</param>
    void Add(ExpenseCategory category);

    /// <summary>
    /// Marks a tracked category for removal. The save that follows throws <see cref="CategoryInUseException"/> when an expense
    /// started using the category after the caller counted (the foreign key is the backstop).
    /// </summary>
    /// <param name="category">The category to remove.</param>
    void Remove(ExpenseCategory category);
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
/// <param name="ExpenseCount">How many expenses use the category, soft-deleted ones included (D-10).</param>
public sealed record ExpenseCategoryView(Guid Id, string Name, string Tone, bool Retired, bool IsOthers, int ExpenseCount);

/// <summary>One category as the detail read returns it, with its row version.</summary>
/// <param name="Id">The category id.</param>
/// <param name="Name">The display name.</param>
/// <param name="Tone">One of the six colour tones.</param>
/// <param name="Retired">True once the category is retired (D-11).</param>
/// <param name="IsOthers">True for the catch-all Others category.</param>
/// <param name="ExpenseCount">How many expenses use the category, soft-deleted ones included (D-10).</param>
/// <param name="RecordedBy">Who added it; null reads as System (the seeded categories).</param>
/// <param name="CreatedAtUtc">When it was added.</param>
/// <param name="LastChangedBy">Who last changed it; null until a change.</param>
/// <param name="UpdatedAtUtc">When it was last changed; null until a change.</param>
/// <param name="RowVersion">The eight-byte row version a save must send back.</param>
public sealed record ExpenseCategoryDetailView(
    Guid Id,
    string Name,
    string Tone,
    bool Retired,
    bool IsOthers,
    int ExpenseCount,
    ActorRef? RecordedBy,
    DateTimeOffset CreatedAtUtc,
    ActorRef? LastChangedBy,
    DateTimeOffset? UpdatedAtUtc,
    byte[] RowVersion);
