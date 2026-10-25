using Csps.Application.Common;

namespace Csps.Application.Expenses;

/// <summary>
/// Builds the audit detail of expense events (D-27). Only the date, the category id, the amount and the payer id go in: the
/// description and the notes can hold personal details, so no text of theirs ever reaches the audit log (D-06).
/// </summary>
public static class ExpenseAuditDetail
{
    /// <summary>Writes the detail of an added expense: <c>date=…;category=&lt;id&gt;;amount=…;payer=&lt;id&gt;</c>.</summary>
    /// <param name="date">The expense date.</param>
    /// <param name="categoryId">The category id.</param>
    /// <param name="amount">The amount.</param>
    /// <param name="payerId">The payer's id.</param>
    /// <returns>The detail text.</returns>
    public static string Snapshot(DateOnly date, Guid categoryId, decimal amount, Guid payerId) =>
        AuditDetailFormat.Join(
            AuditDetailFormat.Pair("date", date),
            AuditDetailFormat.Pair("category", categoryId),
            AuditDetailFormat.Pair("amount", amount),
            AuditDetailFormat.Pair("payer", payerId));
}
