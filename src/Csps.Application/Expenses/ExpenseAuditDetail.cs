using Csps.Application.Common;
using Csps.Domain.Expenses;

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

    /// <summary>
    /// Writes the detail of an edited expense: <c>amount=old&gt;new;date=old&gt;new;category=old&gt;new</c> for each of those that
    /// changed, then <c>fields=description,notes</c> naming the text fields that changed (never their text), then the payer the
    /// expense has after the edit as <c>payer=&lt;id&gt;</c>.
    /// </summary>
    /// <param name="changes">What the edit changed.</param>
    /// <param name="payerAfter">The payer the expense has after the edit.</param>
    /// <returns>The detail text.</returns>
    public static string Changes(ExpenseChanges changes, Guid payerAfter)
    {
        ArgumentNullException.ThrowIfNull(changes);

        var parts = new List<string>();
        if (changes.Amount is { } amount)
        {
            parts.Add(AuditDetailFormat.Change("amount", amount.From, amount.To));
        }

        if (changes.Date is { } date)
        {
            parts.Add(AuditDetailFormat.Change("date", date.From, date.To));
        }

        if (changes.Category is { } category)
        {
            parts.Add(AuditDetailFormat.Change("category", category.From, category.To));
        }

        var fields = new List<string>();
        if (changes.DescriptionChanged)
        {
            fields.Add("description");
        }

        if (changes.NotesChanged)
        {
            fields.Add("notes");
        }

        if (fields.Count > 0)
        {
            parts.Add(AuditDetailFormat.Pair("fields", string.Join(',', fields)));
        }

        parts.Add(AuditDetailFormat.Pair("payer", payerAfter));
        return AuditDetailFormat.Join([.. parts]);
    }

    /// <summary>Writes the detail of a payer change: <c>payer=&lt;old id&gt;&gt;&lt;new id&gt;</c>.</summary>
    /// <param name="from">The payer before the edit.</param>
    /// <param name="to">The payer after the edit.</param>
    /// <returns>The detail text.</returns>
    public static string PayerChange(Guid from, Guid to) => AuditDetailFormat.Change("payer", from, to);
}
