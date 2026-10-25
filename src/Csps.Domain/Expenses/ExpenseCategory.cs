using System.Globalization;
using Csps.Domain.Common;

namespace Csps.Domain.Expenses;

/// <summary>
/// A company expense category (D-08): a row, not a fixed list, so Managers can add, rename, recolor and retire categories. Others
/// can change colour but never its name, and can never be retired or deleted (OQ-6). The attribution members are set only by the
/// database layer from the token and the clock (SEC-08).
/// </summary>
public sealed class ExpenseCategory : IAttributedRecord
{
    /// <summary>The longest category name.</summary>
    public const int NameMaxLength = 40;

    /// <summary>The longest tone text.</summary>
    public const int ToneMaxLength = 16;

    /// <summary>The field name of the category name.</summary>
    public const string NameField = "name";

    /// <summary>The field name of the tone.</summary>
    public const string ToneField = "tone";

    /// <summary>The machine code of a category form that breaks field rules.</summary>
    public const string InvalidCode = "expense-categories.invalid-request";

    /// <summary>The text above the field errors.</summary>
    public const string InvalidMessage = "Check the highlighted fields.";

    /// <summary>The message for a missing name.</summary>
    public const string NameRequiredMessage = "Enter a category name.";

    /// <summary>The message for a name over the limit.</summary>
    public const string NameTooLongMessage = "Keep the name to 40 characters or fewer.";

    /// <summary>The message for a tone outside the six.</summary>
    public const string ToneInvalidMessage = "Choose a badge color.";

    /// <summary>The message for renaming Others (OQ-6).</summary>
    public const string OthersNameMessage = "The Others name can't change.";

    /// <summary>The machine code of an attempt to retire or delete Others (OQ-6).</summary>
    public const string ProtectedCode = "expense-categories.protected";

    /// <summary>The message for an attempt to retire or delete Others (OQ-6).</summary>
    public const string ProtectedMessage = "The Others category can't be retired or deleted.";

    // Used by EF Core (constructor binding), by Create and by FromSeed.
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

    /// <summary>Records a new, active category (D-08), checking the name and tone rules again so no caller can skip one.</summary>
    /// <param name="name">The name; required after trimming, at most 40 characters.</param>
    /// <param name="tone">One of <see cref="CategoryTones"/> (D-13).</param>
    /// <param name="now">The current instant, which makes the key.</param>
    /// <returns>The new, unsaved category, or a validation error naming the first broken field.</returns>
    public static Result<ExpenseCategory> Create(string name, string tone, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(name);
        ArgumentNullException.ThrowIfNull(tone);

        var trimmed = name.Trim();
        if (CheckName(trimmed) is { } nameMessage)
        {
            return Result.Failure<ExpenseCategory>(Reject(NameField, nameMessage));
        }

        if (!CategoryTones.IsValid(tone))
        {
            return Result.Failure<ExpenseCategory>(Reject(ToneField, ToneInvalidMessage));
        }

        return Result.Success(new ExpenseCategory(Guid.CreateVersion7(now), trimmed, Normalize(trimmed), tone, now));
    }

    /// <summary>
    /// Renames the category (D-12). Others keeps its name: sending its own name again is accepted and changes nothing, anything else
    /// is refused (OQ-6).
    /// </summary>
    /// <param name="name">The new name; required after trimming, at most 40 characters.</param>
    /// <returns>The name the category had before, or a validation error on <c>name</c>.</returns>
    public Result<string> Rename(string name)
    {
        ArgumentNullException.ThrowIfNull(name);

        var trimmed = name.Trim();
        if (IsOthers)
        {
            return string.Equals(trimmed, Name, StringComparison.Ordinal)
                ? Result.Success(Name)
                : Result.Failure<string>(Reject(NameField, OthersNameMessage));
        }

        if (CheckName(trimmed) is { } nameMessage)
        {
            return Result.Failure<string>(Reject(NameField, nameMessage));
        }

        var before = Name;
        Name = trimmed;
        NormalizedName = Normalize(trimmed);
        return Result.Success(before);
    }

    /// <summary>Changes the badge colour (D-13). Others may change colour like any other category.</summary>
    /// <param name="tone">One of <see cref="CategoryTones"/>.</param>
    /// <returns>The tone the category had before, or a validation error on <c>tone</c>.</returns>
    public Result<string> Recolor(string tone)
    {
        ArgumentNullException.ThrowIfNull(tone);

        if (!CategoryTones.IsValid(tone))
        {
            return Result.Failure<string>(Reject(ToneField, ToneInvalidMessage));
        }

        var before = Tone;
        Tone = tone;
        return Result.Success(before);
    }

    /// <summary>Retires the category so it can no longer be chosen on a new expense (D-11). Others can never be retired (OQ-6).</summary>
    /// <param name="now">The current instant.</param>
    /// <returns>True when it was retired now, false when it already was, or the protected-category error for Others.</returns>
    public Result<bool> Retire(DateTimeOffset now)
    {
        if (IsOthers)
        {
            return Result.Failure<bool>(Protected());
        }

        if (IsRetired)
        {
            return Result.Success(false);
        }

        RetiredAtUtc = now;
        return Result.Success(true);
    }

    /// <summary>Brings a retired category back so it can be chosen again (OQ-4).</summary>
    /// <returns>True when it was brought back now; false when it was already active.</returns>
    public bool Reactivate()
    {
        if (!IsRetired)
        {
            return false;
        }

        RetiredAtUtc = null;
        return true;
    }

    /// <summary>Gets the error for an attempt to retire or delete Others (OQ-6).</summary>
    /// <returns>The business-rule error.</returns>
    public static Error Protected() => Error.BusinessRule(ProtectedCode, ProtectedMessage);

    private static string? CheckName(string trimmed) => trimmed.Length switch
    {
        0 => NameRequiredMessage,
        > NameMaxLength => NameTooLongMessage,
        _ => null,
    };

    private static Error Reject(string field, string message) =>
        Error.Validation(InvalidCode, InvalidMessage, new Dictionary<string, string[]> { [field] = [message] });
}
