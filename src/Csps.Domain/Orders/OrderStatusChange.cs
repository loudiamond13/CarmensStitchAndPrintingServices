namespace Csps.Domain.Orders;

/// <summary>One row of an order's status history (ORD-16, D-06): from which status to which, who moved it and when.</summary>
public sealed class OrderStatusChange
{
    // Used by EF Core (constructor binding) and by Order.Create.
    internal OrderStatusChange(Guid id, Guid orderId, OrderStatus? fromStatus, OrderStatus toStatus, Guid? changedById, DateTimeOffset changedAtUtc)
    {
        Id = id;
        OrderId = orderId;
        FromStatus = fromStatus;
        ToStatus = toStatus;
        ChangedById = changedById;
        ChangedAtUtc = changedAtUtc;
    }

    /// <summary>Gets the primary key, a version 7 id made by the domain.</summary>
    public Guid Id { get; private set; }

    /// <summary>Gets the order the row belongs to.</summary>
    public Guid OrderId { get; private set; }

    /// <summary>Gets the order the row belongs to.</summary>
    public Order Order { get; internal set; } = null!;

    /// <summary>Gets the status the order left; null for the first row.</summary>
    public OrderStatus? FromStatus { get; private set; }

    /// <summary>Gets the status the order entered.</summary>
    public OrderStatus ToStatus { get; private set; }

    /// <summary>Gets who moved the order; null reads as System.</summary>
    public Guid? ChangedById { get; private set; }

    /// <summary>Gets when the order moved, in UTC.</summary>
    public DateTimeOffset ChangedAtUtc { get; private set; }
}
