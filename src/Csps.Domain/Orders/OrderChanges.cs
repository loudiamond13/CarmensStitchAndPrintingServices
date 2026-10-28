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

/// <summary>
/// What one discount edit changed (D-31). The kind and the value carry the old and new value; the reason carries only a flag,
/// because its text never goes into the audit log.
/// </summary>
/// <param name="Kind">The kind change; null when it stayed.</param>
/// <param name="Value">The value change; null when it stayed.</param>
/// <param name="ReasonChanged">True when the reason text changed.</param>
public sealed record OrderDiscountChanges(ValueChange<DiscountKind>? Kind, ValueChange<decimal>? Value, bool ReasonChanged)
{
    /// <summary>Gets a value that is true when anything at all changed.</summary>
    public bool HasAny => Kind is not null || Value is not null || ReasonChanged;
}

/// <summary>
/// What one item edit changed (D-31). The product type, quantity and unit price carry the old and new value; the description and
/// the size or variant carry only their field names, because their text never goes into the audit log.
/// </summary>
/// <param name="ProductType">The product type change; null when it stayed.</param>
/// <param name="Quantity">The quantity change; null when it stayed.</param>
/// <param name="UnitPrice">The unit price change; null when it stayed.</param>
/// <param name="ChangedFields">The names of the text fields that changed (<c>description</c>, <c>sizeVariant</c>), in form order.</param>
public sealed record OrderItemChanges(ValueChange<Guid>? ProductType, ValueChange<int>? Quantity, ValueChange<decimal>? UnitPrice, IReadOnlyList<string> ChangedFields)
{
    /// <summary>Gets a value that is true when anything at all changed.</summary>
    public bool HasAny => ProductType is not null || Quantity is not null || UnitPrice is not null || ChangedFields.Count > 0;
}

/// <summary>
/// What one payment edit changed (D-31, ORD-22). The date, amount and method carry the old and new value; the reference and the
/// notes carry only their field names, because their text never goes into the audit log. A new receiver is carried on its own,
/// because it is written to the audit log as its own entry.
/// </summary>
/// <param name="Date">The payment date change; null when it stayed.</param>
/// <param name="Amount">The amount change; null when it stayed.</param>
/// <param name="Method">The payment method change; null when it stayed.</param>
/// <param name="Receiver">The receiver change; null when the same person kept the money.</param>
/// <param name="ChangedFields">The names of the text fields that changed (<c>reference</c>, <c>notes</c>), in form order.</param>
public sealed record OrderPaymentChanges(
    ValueChange<DateOnly>? Date,
    ValueChange<decimal>? Amount,
    ValueChange<Guid>? Method,
    ValueChange<Guid>? Receiver,
    IReadOnlyList<string> ChangedFields)
{
    /// <summary>Gets a value that is true when anything at all changed.</summary>
    public bool HasAny => HasFieldChange || Receiver is not null;

    /// <summary>Gets a value that is true when anything other than the receiver changed.</summary>
    public bool HasFieldChange => Date is not null || Amount is not null || Method is not null || ChangedFields.Count > 0;
}
