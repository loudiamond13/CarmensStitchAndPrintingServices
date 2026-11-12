using Csps.Application.Common;
using Csps.Domain.Auditing;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// Builds the detail of the <c>site-settings.changed</c> audit entry (AUDIT-01): a <c>fields=</c> pair that names every changed field,
/// then <c>key=old&gt;new</c> for the business name and the six links that fit. Long texts, the shop email and the phone numbers are
/// named and never copied (D-06): the log holds no personal data. A pair that would push the detail past
/// <see cref="AuditEntry.DetailMaxLength"/> is left out, so the entry is always written.
/// </summary>
public static class SiteSettingsAuditDetail
{
    private const char PairSeparator = ';';
    private const char FieldSeparator = ',';

    private static readonly HashSet<string> ShownFields = new(StringComparer.Ordinal)
    {
        BusinessInfoFields.BusinessName,
        BusinessInfoFields.DirectionsUrl,
        BusinessInfoFields.MapEmbedUrl,
        BusinessInfoFields.MessengerUrl,
        BusinessInfoFields.FacebookUrl,
        BusinessInfoFields.InstagramUrl,
        BusinessInfoFields.TiktokUrl,
    };

    /// <summary>Writes the detail of a save.</summary>
    /// <param name="changedFields">The API names of the changed fields, in form order.</param>
    /// <param name="before">The values before the save, by field name.</param>
    /// <param name="after">The values after the save, by field name.</param>
    /// <returns>The detail text, at most <see cref="AuditEntry.DetailMaxLength"/> characters.</returns>
    public static string Changed(
        IReadOnlyList<string> changedFields,
        IReadOnlyDictionary<string, string?> before,
        IReadOnlyDictionary<string, string?> after)
    {
        ArgumentNullException.ThrowIfNull(changedFields);
        ArgumentNullException.ThrowIfNull(before);
        ArgumentNullException.ThrowIfNull(after);

        var detail = AuditDetailFormat.Pair("fields", string.Join(FieldSeparator, changedFields));
        foreach (var field in changedFields.Where(ShownFields.Contains))
        {
            var pair = AuditDetailFormat.Change(field, before.GetValueOrDefault(field) ?? string.Empty, after.GetValueOrDefault(field) ?? string.Empty);
            if (detail.Length + 1 + pair.Length <= AuditEntry.DetailMaxLength)
            {
                detail = string.Concat(detail, PairSeparator, pair);
            }
        }

        return detail;
    }
}
