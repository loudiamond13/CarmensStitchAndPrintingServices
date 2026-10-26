using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.Users;

namespace Csps.Application.Expenses;

/// <summary>One company expense with who recorded it, who last changed it, its version and whether the caller may edit it (CEXP-02, CEXP-04).</summary>
/// <param name="Id">The expense id.</param>
/// <param name="Date">The day the money was spent.</param>
/// <param name="Category">The category.</param>
/// <param name="Description">What it was for.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="Notes">The notes; null when none.</param>
/// <param name="PaidBy">The payer.</param>
/// <param name="PaidByActive">True while the payer can still be chosen (D-32).</param>
/// <param name="RecordedBy">Who recorded it; null reads as System.</param>
/// <param name="RecordedAt">When it was recorded.</param>
/// <param name="LastChangedBy">Who last changed it; null until an edit.</param>
/// <param name="LastChangedAt">When it was last changed; null until an edit.</param>
/// <param name="Version">The base64 of the eight-byte row version a save must send back.</param>
/// <param name="CanEdit">True when the caller may edit it (D-26).</param>
public sealed record CompanyExpenseDetailResponse(
    Guid Id,
    DateOnly Date,
    ExpenseCategoryRef Category,
    string Description,
    decimal Amount,
    string? Notes,
    ActorRef PaidBy,
    bool PaidByActive,
    ActorRef? RecordedBy,
    DateTimeOffset RecordedAt,
    ActorRef? LastChangedBy,
    DateTimeOffset? LastChangedAt,
    string Version,
    bool CanEdit)
{
    /// <summary>Builds the response from the read model and the caller.</summary>
    /// <param name="view">The expense as read.</param>
    /// <param name="callerId">The signed-in user.</param>
    /// <param name="callerIsManager">True when the caller has the Manager role.</param>
    /// <returns>The response.</returns>
    public static CompanyExpenseDetailResponse From(CompanyExpenseDetailView view, Guid callerId, bool callerIsManager)
    {
        ArgumentNullException.ThrowIfNull(view);
        return new CompanyExpenseDetailResponse(
            view.Id,
            view.Date,
            view.Category,
            view.Description,
            view.Amount,
            view.Notes,
            view.PaidBy,
            view.PaidByActive,
            view.RecordedBy,
            view.CreatedAtUtc,
            view.LastChangedBy,
            view.UpdatedAtUtc,
            RowVersions.ToText(view.RowVersion),
            ExpenseAccess.CanEdit(view.CreatedById, view.PaidByUserId, callerId, callerIsManager));
    }
}
