namespace Csps.Application.Orders;

/// <summary>
/// The Add Expense form on a saved order (ORD-05, ORD-23). It carries the order's version as the form was opened. Any other member
/// in the body, such as a forged <c>createdById</c>, is ignored: who recorded the expense and when come from the token and the
/// clock (SEC-08). Who paid is a separate choice, <c>paidByUserId</c>.
/// </summary>
/// <param name="ExpenseDate">The day of the expense, <c>yyyy-MM-dd</c>.</param>
/// <param name="OrderExpenseCategoryId">The order expense category.</param>
/// <param name="Description">A short description.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="PaidByUserId">The staff member who paid.</param>
/// <param name="Version">The base64 of the eight-byte row version of the order the form was opened with.</param>
public sealed record AddOrderExpenseRequest(
    string? ExpenseDate,
    Guid? OrderExpenseCategoryId,
    string? Description,
    decimal? Amount,
    Guid? PaidByUserId,
    string? Version) : IOrderExpenseFields
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static AddOrderExpenseRequest Empty { get; } = new(null, null, null, null, null, null);
}
