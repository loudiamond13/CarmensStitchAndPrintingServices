using Csps.Application.Common;

namespace Csps.Application.Money;

/// <summary>
/// Builds the audit detail of money transfer events (D-52). Only ids, a <c>0.00</c> amount, a <c>yyyy-MM-dd</c> date and whether
/// there was a note go in: the note text and people's names are free text and never reach the audit log (D-06).
/// </summary>
public static class MoneyAuditDetail
{
    /// <summary>The key of the sender, a user id.</summary>
    public const string FromKey = "from";

    /// <summary>The key of the recipient, a user id.</summary>
    public const string ToKey = "to";

    /// <summary>The key that says whether the transfer had a note: <c>yes</c> or <c>no</c>.</summary>
    public const string NoteKey = "note";

    private const string AmountKey = "amount";
    private const string DateKey = "date";
    private const string Yes = "yes";
    private const string No = "no";

    /// <summary>Writes <c>from=&lt;id&gt;;to=&lt;id&gt;;amount=…;date=…;note=yes|no</c>, the facts of one transfer.</summary>
    /// <param name="from">The sender's id.</param>
    /// <param name="to">The recipient's id.</param>
    /// <param name="amount">The amount.</param>
    /// <param name="date">The transfer date.</param>
    /// <param name="hasNote">Whether the transfer has a note; its text is never written.</param>
    /// <returns>The detail text.</returns>
    public static string Snapshot(Guid from, Guid to, decimal amount, DateOnly date, bool hasNote) =>
        AuditDetailFormat.Join(
            AuditDetailFormat.Pair(FromKey, from),
            AuditDetailFormat.Pair(ToKey, to),
            AuditDetailFormat.Pair(AmountKey, amount),
            AuditDetailFormat.Pair(DateKey, date),
            AuditDetailFormat.Pair(NoteKey, hasNote ? Yes : No));

    /// <summary>Writes the detail of a hand-over: the former staff member, the coworker, the amount, the date and whether there was a note.</summary>
    /// <param name="from">The former staff member's id.</param>
    /// <param name="to">The coworker's id.</param>
    /// <param name="amount">The amount.</param>
    /// <param name="date">The transfer date.</param>
    /// <param name="hasNote">Whether the hand-over has a note; its text is never written.</param>
    /// <returns>The detail text.</returns>
    public static string Handover(Guid from, Guid to, decimal amount, DateOnly date, bool hasNote) =>
        Snapshot(from, to, amount, date, hasNote);
}
