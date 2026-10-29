namespace Csps.Domain.Orders;

/// <summary>One row of an imported order's status history (ORD-16, D-06).</summary>
/// <param name="FromStatus">The status the order left; null for the first row.</param>
/// <param name="ToStatus">The status the order entered.</param>
/// <param name="ChangedById">Who moved the order; null reads as System.</param>
/// <param name="ChangedAtUtc">When the order moved, in UTC.</param>
public sealed record ImportedStatusChange(OrderStatus? FromStatus, OrderStatus ToStatus, Guid? ChangedById, DateTimeOffset ChangedAtUtc);

/// <summary>
/// An order as the legacy data holds it (ORD-21): the number, details, status, and every child with its people named explicitly.
/// The children reuse the record types of the normal create path. Their list order becomes their position. The money figures are
/// not part of the snapshot: <see cref="Order.Import"/> works them out from the children, so no figure can be brought in.
/// </summary>
/// <param name="Number">The order number, kept as given.</param>
/// <param name="Details">The customer and date details.</param>
/// <param name="Status">The current status, any of the seven.</param>
/// <param name="Items">The lines.</param>
public sealed record OrderImportSnapshot(string Number, OrderDetails Details, OrderStatus Status, IReadOnlyList<NewOrderItem> Items)
{
    /// <summary>Gets the discounts; empty by default.</summary>
    public IReadOnlyList<NewOrderDiscount> Discounts { get; init; } = [];

    /// <summary>Gets the payments; empty by default.</summary>
    public IReadOnlyList<NewOrderPayment> Payments { get; init; } = [];

    /// <summary>Gets the refunds; empty by default.</summary>
    public IReadOnlyList<NewOrderRefund> Refunds { get; init; } = [];

    /// <summary>Gets the order expenses; empty by default.</summary>
    public IReadOnlyList<NewOrderExpense> Expenses { get; init; } = [];

    /// <summary>Gets the status history, oldest first; when empty, one row is written (no earlier status, no person, at the import time).</summary>
    public IReadOnlyList<ImportedStatusChange> StatusHistory { get; init; } = [];
}
