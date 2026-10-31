using System.Globalization;
using Csps.Domain.Common;
using Csps.Domain.Expenses;

namespace Csps.Domain.OrderLists;

/// <summary>
/// One entry of a Manager-editable order list (D-19): a row, not a fixed list, so Managers can add, rename, recolor and retire
/// entries. Each list is its own table. The attribution members are set only by the database layer from the token and the clock (SEC-08).
/// </summary>
public abstract class OrderListEntry : IAttributedRecord
{
    /// <summary>The longest entry name.</summary>
    public const int NameMaxLength = 40;

    /// <summary>The longest tone text.</summary>
    public const int ToneMaxLength = 16;

    /// <summary>The field name of the entry name.</summary>
    public const string NameField = "name";

    /// <summary>The field name of the tone.</summary>
    public const string ToneField = "tone";

    /// <summary>The text above the field errors.</summary>
    public const string InvalidMessage = "Check the highlighted fields.";

    /// <summary>The message for a name over the limit.</summary>
    public const string NameTooLongMessage = "Keep the name to 40 characters or fewer.";

    /// <summary>The message for a tone outside the six.</summary>
    public const string ToneInvalidMessage = "Choose a badge color.";

    /// <summary>The message for renaming Others.</summary>
    public const string OthersNameMessage = "The Others name can't change.";

    // Used by EF Core (constructor binding), by Create and by FromSeed.
    private protected OrderListEntry(Guid id, string name, string normalizedName, string tone, DateTimeOffset createdAtUtc)
    {
        Id = id;
        Name = name;
        NormalizedName = normalizedName;
        Tone = tone;
        CreatedAtUtc = createdAtUtc;
        RowVersion = [];
    }

    /// <summary>Primary key.</summary>
    public Guid Id { get; private set; }

    /// <summary>The display name.</summary>
    public string Name { get; private set; }

    /// <summary>The trimmed, upper-cased name the unique index checks.</summary>
    public string NormalizedName { get; private set; }

    /// <summary>One of <see cref="CategoryTones"/>.</summary>
    public string Tone { get; private set; }

    /// <summary>When the entry was retired; null while it can be picked.</summary>
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

    /// <summary>True once the entry is retired.</summary>
    public bool IsRetired => RetiredAtUtc is not null;

    /// <summary>True for a protected catch-all entry; only the order expense Others is one.</summary>
    public virtual bool IsOthers => false;

    /// <summary>The route and error code prefix of the list, for example <c>product-types</c>.</summary>
    private protected abstract string ErrorPrefix { get; }

    /// <summary>The singular noun the messages use, for example <c>product type</c>.</summary>
    private protected abstract string Noun { get; }

    /// <summary>Makes the text the unique index compares: trimmed and upper-cased with the invariant culture.</summary>
    /// <param name="name">The entry name.</param>
    /// <returns>The normalized name.</returns>
    public static string Normalize(string name)
    {
        ArgumentNullException.ThrowIfNull(name);
        return name.Trim().ToUpper(CultureInfo.InvariantCulture);
    }

    /// <summary>Renames the entry. The protected Others keeps its name: sending its own name again is accepted and changes nothing.</summary>
    /// <param name="name">The new name; required after trimming, at most 40 characters.</param>
    /// <returns>The name the entry had before, or a validation error on <c>name</c>.</returns>
    public Result<string> Rename(string name)
    {
        ArgumentNullException.ThrowIfNull(name);

        var trimmed = name.Trim();
        if (IsOthers)
        {
            return string.Equals(trimmed, Name, StringComparison.Ordinal)
                ? Result.Success(Name)
                : Result.Failure<string>(Reject(ErrorPrefix, NameField, OthersNameMessage));
        }

        if (CheckName(trimmed, Noun) is { } nameMessage)
        {
            return Result.Failure<string>(Reject(ErrorPrefix, NameField, nameMessage));
        }

        var before = Name;
        Name = trimmed;
        NormalizedName = Normalize(trimmed);
        return Result.Success(before);
    }

    /// <summary>Changes the badge colour. The protected Others may change colour like any other entry.</summary>
    /// <param name="tone">One of <see cref="CategoryTones"/>.</param>
    /// <returns>The tone the entry had before, or a validation error on <c>tone</c>.</returns>
    public Result<string> Recolor(string tone)
    {
        ArgumentNullException.ThrowIfNull(tone);

        if (!CategoryTones.IsValid(tone))
        {
            return Result.Failure<string>(Reject(ErrorPrefix, ToneField, ToneInvalidMessage));
        }

        var before = Tone;
        Tone = tone;
        return Result.Success(before);
    }

    /// <summary>Retires the entry so it can no longer be chosen. The protected Others can never be retired.</summary>
    /// <param name="now">The current instant.</param>
    /// <returns>True when it was retired now, false when it already was, or the protected-entry error.</returns>
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

    /// <summary>Brings a retired entry back so it can be chosen again.</summary>
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

    /// <summary>Gets the error for an attempt to rename, retire or delete the protected Others.</summary>
    /// <returns>The business-rule error.</returns>
    public Error Protected() => Error.BusinessRule($"{ErrorPrefix}.protected", $"The Others {Noun} can't be renamed, retired or deleted.");

    /// <summary>Checks the name and tone again and builds a new, active entry, so no caller can skip a rule.</summary>
    private protected static Result<TEntry> Build<TEntry>(
        string name,
        string tone,
        DateTimeOffset now,
        string errorPrefix,
        string noun,
        Func<Guid, string, string, string, DateTimeOffset, TEntry> factory)
        where TEntry : OrderListEntry
    {
        ArgumentNullException.ThrowIfNull(name);
        ArgumentNullException.ThrowIfNull(tone);

        var trimmed = name.Trim();
        if (CheckName(trimmed, noun) is { } nameMessage)
        {
            return Result.Failure<TEntry>(Reject(errorPrefix, NameField, nameMessage));
        }

        if (!CategoryTones.IsValid(tone))
        {
            return Result.Failure<TEntry>(Reject(errorPrefix, ToneField, ToneInvalidMessage));
        }

        return Result.Success(factory(Guid.CreateVersion7(now), trimmed, Normalize(trimmed), tone, now));
    }

    private static string? CheckName(string trimmed, string noun) => trimmed.Length switch
    {
        0 => $"Enter a {noun} name.",
        > NameMaxLength => NameTooLongMessage,
        _ => null,
    };

    private static Error Reject(string errorPrefix, string field, string message) =>
        Error.Validation($"{errorPrefix}.invalid-request", InvalidMessage, new Dictionary<string, string[]> { [field] = [message] });
}
