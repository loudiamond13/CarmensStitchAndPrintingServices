namespace Csps.Application.Orders;

/// <summary>
/// The Edit Discount form on a saved order (D-15, ORD-05). It carries the order's version as the form was opened. Any other member
/// in the body, such as a forged <c>updatedById</c>, is ignored: who changed the discount and when come from the token and the
/// clock (SEC-08).
/// </summary>
/// <param name="Kind">The kind: <c>fixed</c> or <c>percentage</c>.</param>
/// <param name="Value">The peso amount (fixed) or the percent (percentage).</param>
/// <param name="Reason">Why the discount is given.</param>
/// <param name="Version">The base64 of the eight-byte row version of the order the form was opened with.</param>
public sealed record UpdateOrderDiscountRequest(string? Kind, decimal? Value, string? Reason, string? Version) : IOrderDiscountFields
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static UpdateOrderDiscountRequest Empty { get; } = new(null, null, null, null);
}
