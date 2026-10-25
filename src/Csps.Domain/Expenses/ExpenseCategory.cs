using System.Globalization;
using Csps.Domain.Common;

namespace Csps.Domain.Expenses;

/// <summary>
/// A company expense category (D-08): a row, not a fixed list, so the owner's staff can add and retire categories later.
/// Create, rename, recolor, retire and reactivate arrive with the category management plan.
/// </summary>
public sealed class ExpenseCategory : IAttributedRecord
{
    /// <summary>The longest category name.</summary>
    public const int NameMaxLength = 40;

    /// <summary>The longest tone text.</summary>
    public const int ToneMaxLength = 16;

    // Used by EF Core (constructor binding) and by FromSeed.
    private ExpenseCategory(Guid id, string name, string normalizedName, string tone, DateTimeOffset createdAtUtc)
    {
        Id = id;
        Name = name;
        NormalizedName = normalizedName;
        Tone = tone;
        CreatedAtUtc = createdAtUtc;
        RowVersion = [];
    }

    /// <summary>The id of Others, which can never be retired or deleted.</summary>
    public static Guid OthersId => ExpenseCategorySeed.OthersId;

    /// <summary>Primary key.</summary>
    public Guid Id { get; private set; }

    /// <summary>The display name.</summary>
    public string Name { get; private set; }

    /// <summary>The trimmed, upper-cased name the unique index checks.</summary>
    public string NormalizedName { get; private set; }

    /// <summary>One of <see cref="CategoryTones"/>.</summary>
    public string Tone { get; private set; }

    /// <summary>When the category was retired; null while it can be picked.</summary>
    public DateTimeOffset? RetiredAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    /// <summary>The row version a save must match (409 on a conflict).</summary>
    public byte[] RowVersion { get; private set; }

    /// <summary>True once the category is retired.</summary>
    public bool IsRetired => RetiredAtUtc is not null;

    /// <summary>True for the catch-all Others category.</summary>
    public bool IsOthers => Id == OthersId;

    /// <summary>Makes the text the unique index compares: trimmed and upper-cased with the invariant culture.</summary>
    /// <param name="name">The category name.</param>
    /// <returns>The normalized name.</returns>
    public static string Normalize(string name)
    {
        ArgumentNullException.ThrowIfNull(name);
        return name.Trim().ToUpper(CultureInfo.InvariantCulture);
    }

    /// <summary>Builds a seeded category with its fixed creation stamp and no attribution (it reads as System).</summary>
    /// <param name="row">The seed row.</param>
    /// <returns>The category.</returns>
    public static ExpenseCategory FromSeed(ExpenseCategorySeedRow row)
    {
        ArgumentNullException.ThrowIfNull(row);
        return new ExpenseCategory(row.Id, row.Name, Normalize(row.Name), row.Tone, ExpenseCategorySeed.SeededAtUtc);
    }
}
