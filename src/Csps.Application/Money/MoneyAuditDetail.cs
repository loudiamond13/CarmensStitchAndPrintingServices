using System.Globalization;
using Csps.Application.Common;
using Csps.Domain.Money;

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

    /// <summary>The key of who recorded the transfer, a user id.</summary>
    public const string RecordedByKey = "recordedBy";

    /// <summary>The key that says whether the transfer was a hand-over: <c>yes</c> or <c>no</c> (D-111).</summary>
    public const string HandoverKey = "handover";

    /// <summary>The key of who deleted the transfer, a user id.</summary>
    public const string DeletedByKey = "deletedBy";

    /// <summary>The key of when the transfer was deleted, a UTC instant such as <c>2026-11-04T02:00:00Z</c>.</summary>
    public const string DeletedAtKey = "deletedAt";

    private const string AmountKey = "amount";
    private const string DateKey = "date";
    private const string Yes = "yes";
    private const string No = "no";
    private const string InstantFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'";

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

    /// <summary>
    /// Writes the detail of a soft delete: the facts of the transfer and who recorded it. The note text is never written, and the Manager
    /// who deleted it is the entry's actor.
    /// </summary>
    /// <param name="transfer">The transfer that was just deleted.</param>
    /// <returns>The detail text.</returns>
    public static string Deleted(MoneyTransfer transfer)
    {
        ArgumentNullException.ThrowIfNull(transfer);
        return AuditDetailFormat.Join([.. Facts(transfer)]);
    }

    /// <summary>
    /// Writes the detail of a permanent remove: the full record as ids and values, so the audit entry outlives the row, including
    /// whether it was a hand-over (D-111). The note text is never written.
    /// </summary>
    /// <param name="transfer">The soft-deleted transfer about to be removed.</param>
    /// <returns>The detail text.</returns>
    public static string Removed(MoneyTransfer transfer)
    {
        ArgumentNullException.ThrowIfNull(transfer);
        List<string> parts = [.. Facts(transfer), AuditDetailFormat.Pair(HandoverKey, transfer.IsHandover ? Yes : No)];
        if (transfer.DeletedById is { } deletedBy)
        {
            parts.Add(AuditDetailFormat.Pair(DeletedByKey, deletedBy));
        }

        if (transfer.DeletedAtUtc is { } deletedAt)
        {
            parts.Add(AuditDetailFormat.Pair(DeletedAtKey, deletedAt.UtcDateTime.ToString(InstantFormat, CultureInfo.InvariantCulture)));
        }

        return AuditDetailFormat.Join([.. parts]);
    }

    // from, to, amount, date, note and, when known, recordedBy.
    private static IEnumerable<string> Facts(MoneyTransfer transfer)
    {
        yield return AuditDetailFormat.Pair(FromKey, transfer.FromUserId);
        yield return AuditDetailFormat.Pair(ToKey, transfer.ToUserId);
        yield return AuditDetailFormat.Pair(AmountKey, transfer.Amount);
        yield return AuditDetailFormat.Pair(DateKey, transfer.TransferDate);
        yield return AuditDetailFormat.Pair(NoteKey, transfer.Note is null ? No : Yes);
        if (transfer.CreatedById is { } recordedBy)
        {
            yield return AuditDetailFormat.Pair(RecordedByKey, recordedBy);
        }
    }
}
