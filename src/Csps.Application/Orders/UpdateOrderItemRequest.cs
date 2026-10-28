namespace Csps.Application.Orders;

/// <summary>
/// The Edit Item form on a saved order (ORD-05, ORD-13). It carries the order's version as the form was opened. Any other member in
/// the body, such as a forged <c>updatedById</c> or <c>lineTotal</c>, is ignored: who changed the item and when come from the token
/// and the clock (SEC-08), and the line total is worked out by the server.
/// </summary>
/// <param name="ProductTypeId">The product type.</param>
/// <param name="Description">What the line is.</param>
/// <param name="SizeVariant">The size or variant.</param>
/// <param name="Quantity">How many.</param>
/// <param name="UnitPrice">The price of one, in pesos.</param>
/// <param name="Version">The base64 of the eight-byte row version of the order the form was opened with.</param>
public sealed record UpdateOrderItemRequest(Guid? ProductTypeId, string? Description, string? SizeVariant, int? Quantity, decimal? UnitPrice, string? Version) : IOrderItemFields
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static UpdateOrderItemRequest Empty { get; } = new(null, null, null, null, null, null);
}
