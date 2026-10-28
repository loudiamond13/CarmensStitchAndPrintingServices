namespace Csps.Application.Orders;

/// <summary>
/// The Add Payment form on a saved order (ORD-05, ORD-22). It carries the order's version as the form was opened. Any other member
/// in the body, such as a forged <c>createdById</c>, is ignored: who recorded the payment and when come from the token and the
/// clock (SEC-08). Who received the money is a separate choice, <c>receivedByUserId</c>.
/// </summary>
/// <param name="PaymentDate">The day the money was received, <c>yyyy-MM-dd</c>.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="PaymentMethodId">The payment method.</param>
/// <param name="Reference">The reference, such as a transfer number.</param>
/// <param name="Notes">Free notes.</param>
/// <param name="ReceivedByUserId">The staff member who received the money.</param>
/// <param name="Version">The base64 of the eight-byte row version of the order the form was opened with.</param>
public sealed record AddOrderPaymentRequest(
    string? PaymentDate,
    decimal? Amount,
    Guid? PaymentMethodId,
    string? Reference,
    string? Notes,
    Guid? ReceivedByUserId,
    string? Version) : IOrderPaymentFields
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static AddOrderPaymentRequest Empty { get; } = new(null, null, null, null, null, null, null);
}
