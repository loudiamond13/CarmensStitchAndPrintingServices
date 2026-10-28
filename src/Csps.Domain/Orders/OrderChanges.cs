using Csps.Domain.Expenses;

namespace Csps.Domain.Orders;

/// <summary>A due date moved to a new day; the old one is null for an imported order that had none.</summary>
/// <param name="From">The due date before the edit; null when there was none.</param>
/// <param name="To">The due date after the edit.</param>
public sealed record DueDateChange(DateOnly? From, DateOnly To);

/// <summary>
/// What one details edit changed on an order (D-31). The order date and the due date carry the old and new day; the customer
/// details and the notes carry only their field names, because their text never goes into the audit log.
/// </summary>
/// <param name="OrderDate">The order date change; null when the date stayed.</param>
/// <param name="DueDate">The due date change; null when the date stayed.</param>
/// <param name="ChangedFields">The names of the customer details and notes that changed, in form order.</param>
public sealed record OrderDetailsChanges(ValueChange<DateOnly>? OrderDate, DueDateChange? DueDate, IReadOnlyList<string> ChangedFields)
{
    /// <summary>Gets a value that is true when anything at all changed.</summary>
    public bool HasAny => OrderDate is not null || DueDate is not null || ChangedFields.Count > 0;
}
