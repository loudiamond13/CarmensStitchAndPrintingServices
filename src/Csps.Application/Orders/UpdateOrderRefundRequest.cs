namespace Csps.Application.Orders;

/// <summary>
/// The Edit Refund form on a saved order (ORD-18, D-07, D-35). It carries the order's version as the form was opened. Any other
/// member in the body, such as a forged <c>updatedById</c>, is ignored: who changed the refund and when come from the token and the
/// clock (SEC-08). Who handed the money back is a separate choice, <c>refundedByUserId</c>.
/// </summary>
/// <param name="RefundDate">The day the money was handed back, <c>yyyy-MM-dd</c>.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="Reason">A short reason, 1 to 200 characters.</param>
/// <param name="RefundedByUserId">The staff member who handed the money back.</param>
/// <param name="Version">The base64 of the eight-byte row version of the order the form was opened with.</param>
public sealed record UpdateOrderRefundRequest(
    string? RefundDate,
    decimal? Amount,
    string? Reason,
    Guid? RefundedByUserId,
    string? Version) : IOrderRefundFields
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static UpdateOrderRefundRequest Empty { get; } = new(null, null, null, null, null);
}
