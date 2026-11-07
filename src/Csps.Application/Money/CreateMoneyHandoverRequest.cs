namespace Csps.Application.Money;

/// <summary>
/// The Hand Over form (D-17): a Manager moves money held by a former staff member to a current coworker. The sender is the former
/// staff member named in the form, because the signed-in Manager only records the hand-over. Any other member in the body, such as
/// <c>createdById</c> or <c>isHandover</c>, is ignored: who recorded it and when come from the token and the clock (SEC-08).
/// </summary>
/// <param name="FromUserId">The former staff member who holds the money.</param>
/// <param name="ToUserId">The current coworker who gets the money.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="TransferDate">The day the money changed hands, <c>yyyy-MM-dd</c>.</param>
/// <param name="Note">Optional note.</param>
public sealed record CreateMoneyHandoverRequest(Guid? FromUserId, Guid? ToUserId, decimal? Amount, string? TransferDate, string? Note)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static CreateMoneyHandoverRequest Empty { get; } = new(null, null, null, null, null);
}
