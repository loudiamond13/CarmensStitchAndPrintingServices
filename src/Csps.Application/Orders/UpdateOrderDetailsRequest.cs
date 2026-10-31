namespace Csps.Application.Orders;

/// <summary>
/// The Edit Order details form (ORD-05, SEC-07). It carries the version the form was opened with. Any other member in the body,
/// such as a forged <c>createdById</c>, <c>updatedById</c>, <c>number</c>, <c>status</c> or <c>totals</c>, is ignored: who changed the
/// order and when come from the token and the clock (SEC-08), and the number, status and money figures are not editable here.
/// </summary>
/// <param name="CustomerName">The customer's name.</param>
/// <param name="TeamName">The team or club name.</param>
/// <param name="ContactNumber">The contact number.</param>
/// <param name="Email">The email address.</param>
/// <param name="Address">The address.</param>
/// <param name="OrderDate">The day the order was taken, <c>yyyy-MM-dd</c>.</param>
/// <param name="DueDate">The day it is due, <c>yyyy-MM-dd</c>.</param>
/// <param name="Notes">Free notes.</param>
/// <param name="Version">The base64 of the eight-byte row version the form was opened with.</param>
public sealed record UpdateOrderDetailsRequest(
    string? CustomerName,
    string? TeamName,
    string? ContactNumber,
    string? Email,
    string? Address,
    string? OrderDate,
    string? DueDate,
    string? Notes,
    string? Version) : IOrderDetailsFields
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static UpdateOrderDetailsRequest Empty { get; } = new(null, null, null, null, null, null, null, null, null);
}
