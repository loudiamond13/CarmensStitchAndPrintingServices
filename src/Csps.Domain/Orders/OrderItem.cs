using Csps.Domain.Common;

namespace Csps.Domain.Orders;

/// <summary>
/// One line of an order (ORD-13): a product type, a description, an optional size or variant, a quantity and a unit price.
/// The line total is stored with the line. Who added it and when are set only by the database layer (SEC-08).
/// </summary>
public sealed class OrderItem : IAttributedRecord
{
    // Used by EF Core (constructor binding) and by Order.Create.
    internal OrderItem(Guid id, Guid orderId, Guid productTypeId, string description, string? sizeVariant, int quantity, decimal unitPrice, decimal lineTotal, int position)
    {
        Id = id;
        OrderId = orderId;
        ProductTypeId = productTypeId;
        Description = description;
        SizeVariant = sizeVariant;
        Quantity = quantity;
        UnitPrice = unitPrice;
        LineTotal = lineTotal;
        Position = position;
    }

    /// <summary>Gets the primary key, a version 7 id made by the domain.</summary>
    public Guid Id { get; private set; }

    /// <summary>Gets the order the line belongs to.</summary>
    public Guid OrderId { get; private set; }

    /// <summary>Gets the order the line belongs to.</summary>
    public Order Order { get; internal set; } = null!;

    /// <summary>Gets the product type.</summary>
    public Guid ProductTypeId { get; private set; }

    /// <summary>Gets what the line is, trimmed.</summary>
    public string Description { get; private set; }

    /// <summary>Gets the size or variant, trimmed; null when none.</summary>
    public string? SizeVariant { get; private set; }

    /// <summary>Gets how many.</summary>
    public int Quantity { get; private set; }

    /// <summary>Gets the price of one, in pesos.</summary>
    public decimal UnitPrice { get; private set; }

    /// <summary>Gets the quantity times the unit price.</summary>
    public decimal LineTotal { get; private set; }

    /// <summary>Gets the place of the line in the order, from 0; a removal leaves a gap, and a new line goes after the highest.</summary>
    public int Position { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    // Takes the new values, already checked and trimmed by Order.UpdateItem, and works the line total out again.
    internal void Apply(NewOrderItem values)
    {
        ProductTypeId = values.ProductTypeId;
        Description = values.Description;
        SizeVariant = values.SizeVariant;
        Quantity = values.Quantity;
        UnitPrice = values.UnitPrice;
        LineTotal = values.Quantity * values.UnitPrice;
    }
}
