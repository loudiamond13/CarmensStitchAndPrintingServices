using Csps.Domain.Common;

namespace Csps.Domain.Orders;

/// <summary>
/// One discount on an order (D-15, ORD-05): a fixed peso amount or a percentage of the subtotal, with the reason it was given.
/// An order may hold many. Who added it and when are set only by the database layer (SEC-08).
/// </summary>
public sealed class OrderDiscount : IAttributedRecord
{
    // Used by EF Core (constructor binding) and by Order.
    internal OrderDiscount(Guid id, Guid orderId, DiscountKind kind, decimal value, string reason, int position)
    {
        Id = id;
        OrderId = orderId;
        Kind = kind;
        Value = value;
        Reason = reason;
        Position = position;
    }

    /// <summary>Gets the primary key, a version 7 id made by the domain.</summary>
    public Guid Id { get; private set; }

    /// <summary>Gets the order the discount belongs to.</summary>
    public Guid OrderId { get; private set; }

    /// <summary>Gets the order the discount belongs to.</summary>
    public Order Order { get; internal set; } = null!;

    /// <summary>Gets how the value is read: a fixed peso amount or a percentage.</summary>
    public DiscountKind Kind { get; private set; }

    /// <summary>Gets the peso amount (fixed) or the percent (percentage).</summary>
    public decimal Value { get; private set; }

    /// <summary>Gets why the discount was given, trimmed.</summary>
    public string Reason { get; private set; }

    /// <summary>Gets the place of the discount in the order, from 0; a removal leaves a gap, and a new discount goes after the highest.</summary>
    public int Position { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    // Takes the new values, already checked and trimmed by Order.UpdateDiscount.
    internal void Apply(NewOrderDiscount values)
    {
        Kind = values.Kind;
        Value = values.Value;
        Reason = values.Reason;
    }
}
