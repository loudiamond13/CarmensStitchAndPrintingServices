using Csps.Application.Common;
using Csps.Domain.Auditing;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// Builds the detail of the <c>gallery-photo.*</c> and <c>gallery-item.moved</c> audit entries (AUDIT-01, T-11-73). An entry names the
/// team or name shown (public anyway) and the line title, never the address of the photo. A change names every changed field in a
/// <c>fields=</c> pair and then holds <c>team=old&gt;new</c> and <c>line=old&gt;new</c> for the short values that changed. The note is
/// named and never copied, so the audit screen reads <c>fields=note</c> as "Note changed". A pair that would push the detail past
/// <see cref="AuditEntry.DetailMaxLength"/> is left out, so the entry is always written.
/// </summary>
public static class GalleryAuditDetail
{
    /// <summary>The target type of every gallery audit entry.</summary>
    public const string TargetType = "GalleryEntry";

    private const char PairSeparator = ';';

    /// <summary>Writes the detail of an added, hidden, shown or deleted upload: its team and the line title.</summary>
    /// <param name="entry">The upload.</param>
    /// <param name="lineTitle">The title of the line it is filed under.</param>
    /// <returns>The detail text.</returns>
    public static string Named(GalleryEntry entry, string lineTitle)
    {
        ArgumentNullException.ThrowIfNull(entry);
        ArgumentNullException.ThrowIfNull(lineTitle);
        return Fit(AuditDetailFormat.Pair("team", entry.TeamName ?? string.Empty), AuditDetailFormat.Pair("line", lineTitle));
    }

    // Joins the pairs in order and drops any pair that would not fit.
    private static string Fit(params string[] pairs)
    {
        var detail = pairs[0];
        foreach (var pair in pairs.Skip(1).Where(pair => detail.Length + 1 + pair.Length <= AuditEntry.DetailMaxLength))
        {
            detail = string.Concat(detail, PairSeparator, pair);
        }

        return detail;
    }
}
