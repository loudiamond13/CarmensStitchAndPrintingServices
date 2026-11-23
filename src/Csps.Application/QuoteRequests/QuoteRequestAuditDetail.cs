using System.Globalization;
using Csps.Application.Common;
using Csps.Domain.QuoteRequests;

namespace Csps.Application.QuoteRequests;

/// <summary>
/// The detail text of the quote request audit entries. It names statuses only, never the visitor's name, phone, email or message
/// (CWE-532), and stays under the audit log's detail limit.
/// </summary>
public static class QuoteRequestAuditDetail
{
    /// <summary>The audit target type of every quote request entry; the target id is the request id.</summary>
    public const string Target = "QuoteRequest";

    /// <summary>The detail of <c>quote-request.status-changed</c>.</summary>
    /// <param name="from">The status the request left.</param>
    /// <param name="to">The status the request entered.</param>
    /// <returns>For example <c>status=new&gt;contacted</c>.</returns>
    public static string StatusChanged(QuoteRequestStatus from, QuoteRequestStatus to) =>
        AuditDetailFormat.Change("status", QuoteRequestStatusNames.ToKey(from), QuoteRequestStatusNames.ToKey(to));

    /// <summary>The detail of <c>quote-request.note-added</c>: the note id, never its text.</summary>
    /// <param name="noteId">The new note.</param>
    /// <returns>For example <c>note=0196...</c>.</returns>
    public static string NoteAdded(Guid noteId) => AuditDetailFormat.Pair("note", noteId);

    /// <summary>The detail of <c>quote-request.deleted</c>: the status and how many stored photos were queued for removal.</summary>
    /// <param name="status">The status the request had.</param>
    /// <param name="photos">How many stored photos were queued.</param>
    /// <returns>For example <c>status=contacted;photos=2</c>.</returns>
    public static string Deleted(QuoteRequestStatus status, int photos) => AuditDetailFormat.Join(
        AuditDetailFormat.Pair("status", QuoteRequestStatusNames.ToKey(status)),
        AuditDetailFormat.Pair("photos", photos.ToString(CultureInfo.InvariantCulture)));
}
