namespace Csps.Domain.Expenses;

/// <summary>One value that an edit moved from an old value to a new one.</summary>
/// <typeparam name="T">The value type.</typeparam>
/// <param name="From">The value before the edit.</param>
/// <param name="To">The value after the edit.</param>
public sealed record ValueChange<T>(T From, T To)
    where T : struct;

/// <summary>
/// What one edit changed on an expense (D-27). Amount, date, category and payer carry the old and new value; the description and
/// the notes carry only a flag, because their text never goes into the audit log.
/// </summary>
/// <param name="Amount">The amount change; null when the amount stayed.</param>
/// <param name="Date">The date change; null when the date stayed.</param>
/// <param name="Category">The category change; null when the category stayed.</param>
/// <param name="Payer">The payer change; null when the payer stayed.</param>
/// <param name="DescriptionChanged">True when the description changed.</param>
/// <param name="NotesChanged">True when the notes changed.</param>
public sealed record ExpenseChanges(
    ValueChange<decimal>? Amount,
    ValueChange<DateOnly>? Date,
    ValueChange<Guid>? Category,
    ValueChange<Guid>? Payer,
    bool DescriptionChanged,
    bool NotesChanged)
{
    /// <summary>Gets a value that is true when anything at all changed.</summary>
    public bool HasAny => HasFieldChange || Payer is not null;

    /// <summary>Gets a value that is true when anything other than the payer changed.</summary>
    public bool HasFieldChange =>
        Amount is not null || Date is not null || Category is not null || DescriptionChanged || NotesChanged;
}
