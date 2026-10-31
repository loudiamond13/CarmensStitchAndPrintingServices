namespace Csps.Application.Orders;

/// <summary>The item fields the New Order form and the item routes share, so one validator checks them all (ORD-13, D-30).</summary>
public interface IOrderItemFields
{
    /// <summary>Gets the product type.</summary>
    Guid? ProductTypeId { get; }

    /// <summary>Gets what the line is.</summary>
    string? Description { get; }

    /// <summary>Gets the size or variant.</summary>
    string? SizeVariant { get; }

    /// <summary>Gets how many.</summary>
    int? Quantity { get; }

    /// <summary>Gets the price of one, in pesos.</summary>
    decimal? UnitPrice { get; }
}
