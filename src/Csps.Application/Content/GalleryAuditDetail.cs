using System.Globalization;
using Csps.Application.Common;
using Csps.Domain.Auditing;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// Builds the detail of the <c>gallery-photo.*</c> and <c>gallery-item.moved</c> audit entries (AUDIT-01, T-11-73). An entry names the
/// team or name shown (public anyway) and the line title, never the address of the photo. A change names every changed field in a
/// <c>fields=</c> pair and then holds <c>team=old&gt;new</c> and <c>line=old&gt;new</c> for the short values that changed. The note is
/// named and never copied, so the audit screen reads <c>fields=note</c> as "Note changed". A replaced photo is <c>fields=photo</c>. A pair
/// that would push the detail past <see cref="AuditEntry.DetailMaxLength"/> is left out, so the entry is always written.
/// </summary>
public static class GalleryAuditDetail
{
    /// <summary>The target type of every gallery audit entry.</summary>
    public const string TargetType = "GalleryEntry";

    /// <summary>The detail of a replaced photo: the field name only.</summary>
    public const string PhotoReplaced = "fields=photo";

    private const char FieldSeparator = ',';

    /// <summary>Writes the detail of an added, hidden, shown or deleted upload: its team and the line title.</summary>
    /// <param name="entry">The upload.</param>
    /// <param name="lineTitle">The title of the line it is filed under.</param>
    /// <returns>The detail text.</returns>
    public static string Named(GalleryEntry entry, string lineTitle)
    {
        ArgumentNullException.ThrowIfNull(entry);
        ArgumentNullException.ThrowIfNull(lineTitle);
        return AuditDetailFormat.Fit(AuditDetailFormat.Pair("team", entry.TeamName ?? string.Empty), AuditDetailFormat.Pair("line", lineTitle));
    }

    /// <summary>Writes the detail of a changed upload.</summary>
    /// <param name="change">What changed.</param>
    /// <param name="oldLineTitle">The title of the line before; used when the line changed.</param>
    /// <param name="newLineTitle">The title of the line after; used when the line changed.</param>
    /// <returns>The detail text.</returns>
    public static string Changed(GalleryUploadChanges change, string oldLineTitle, string newLineTitle)
    {
        ArgumentNullException.ThrowIfNull(change);
        ArgumentNullException.ThrowIfNull(oldLineTitle);
        ArgumentNullException.ThrowIfNull(newLineTitle);

        List<string> pairs = [AuditDetailFormat.Pair("fields", string.Join(FieldSeparator, change.Fields))];
        if (change.Fields.Contains("team"))
        {
            pairs.Add(AuditDetailFormat.Change("team", change.OldTeam, change.NewTeam));
        }

        if (change.Fields.Contains("line"))
        {
            pairs.Add(AuditDetailFormat.Change("line", oldLineTitle, newLineTitle));
        }

        return AuditDetailFormat.Fit([.. pairs]);
    }

    /// <summary>Writes the detail of a move: the kind, the name shown and the old and new place in the list, counted from 1.</summary>
    /// <param name="kind">An order or an upload.</param>
    /// <param name="name">The name shown.</param>
    /// <param name="oldRank">The place before.</param>
    /// <param name="newRank">The place after.</param>
    /// <returns>The detail text.</returns>
    public static string Moved(GalleryEntryKind kind, string name, int oldRank, int newRank)
    {
        ArgumentNullException.ThrowIfNull(name);
        return AuditDetailFormat.Fit(
            AuditDetailFormat.Pair("kind", kind == GalleryEntryKind.Upload ? GalleryItemRowDto.UploadKind : GalleryItemRowDto.OrderKind),
            AuditDetailFormat.Pair("name", name),
            AuditDetailFormat.Change("position", oldRank.ToString(CultureInfo.InvariantCulture), newRank.ToString(CultureInfo.InvariantCulture)));
    }
}
