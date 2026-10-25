namespace Csps.Application.Expenses;

/// <summary>
/// The Edit Expense form (CEXP-02, SEC-07). It carries the version the form was opened with. Any other member in the body, such as a
/// forged <c>createdById</c>, <c>createdAt</c>, <c>updatedById</c> or <c>updatedAt</c>, is ignored: who changed the expense and when
/// come from the token and the clock (SEC-08).
/// </summary>
/// <param name="Date">The day the money was spent, <c>yyyy-MM-dd</c>.</param>
/// <param name="CategoryId">The category.</param>
/// <param name="Description">What it was for.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="PaidByUserId">The staff member who paid.</param>
/// <param name="Notes">Optional notes.</param>
/// <param name="Version">The base64 of the eight-byte row version the form was opened with.</param>
public sealed record UpdateCompanyExpenseRequest(string? Date, Guid? CategoryId, string? Description, decimal? Amount, Guid? PaidByUserId, string? Notes, string? Version)
    : IExpenseFieldsRequest
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static UpdateCompanyExpenseRequest Empty { get; } = new(null, null, null, null, null, null, null);
}
