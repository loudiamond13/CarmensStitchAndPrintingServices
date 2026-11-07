namespace Csps.Application.Money;

/// <summary>
/// The Transfer Money form (MONEY-04). The sender is always the signed-in user, so the form has no sender. Any other member in
/// the body, such as a forged sender or <c>createdById</c>, is ignored: who recorded the transfer and when come from the token and
/// the clock (SEC-08).
/// </summary>
/// <param name="ToUserId">The coworker who gets the money.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="TransferDate">The day the money changed hands, <c>yyyy-MM-dd</c>.</param>
/// <param name="Note">Optional note.</param>
public sealed record CreateMoneyTransferRequest(Guid? ToUserId, decimal? Amount, string? TransferDate, string? Note)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static CreateMoneyTransferRequest Empty { get; } = new(null, null, null, null);
}
