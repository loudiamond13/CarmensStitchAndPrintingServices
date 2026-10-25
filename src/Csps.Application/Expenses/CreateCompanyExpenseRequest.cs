namespace Csps.Application.Expenses;

/// <summary>
/// The Add Expense form (CEXP-02). Any other member in the body, such as a forged <c>createdById</c> or <c>createdAt</c>, is
/// ignored: who recorded the expense and when come from the token and the clock (SEC-08).
/// </summary>
/// <param name="Date">The day the money was spent, <c>yyyy-MM-dd</c>.</param>
/// <param name="CategoryId">The category.</param>
/// <param name="Description">What it was for.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="PaidByUserId">The staff member who paid.</param>
/// <param name="Notes">Optional notes.</param>
public sealed record CreateCompanyExpenseRequest(string? Date, Guid? CategoryId, string? Description, decimal? Amount, Guid? PaidByUserId, string? Notes)
    : IExpenseFieldsRequest
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static CreateCompanyExpenseRequest Empty { get; } = new(null, null, null, null, null, null);
}
