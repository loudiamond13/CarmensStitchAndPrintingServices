namespace Csps.Application.Orders;

/// <summary>
/// The Change Status action on a saved order (ORD-17). It carries no version: the move is judged on the latest state. Any other
/// member in the body, such as a forged <c>changedBy</c>, is ignored: who moved the order and when come from the token and the
/// clock (SEC-08).
/// </summary>
/// <param name="Status">The status key: pending, mockup, production, ready, delivered, completed or cancelled.</param>
public sealed record ChangeOrderStatusRequest(string? Status)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports the missing status.</summary>
    public static ChangeOrderStatusRequest Empty { get; } = new((string?)null);
}
