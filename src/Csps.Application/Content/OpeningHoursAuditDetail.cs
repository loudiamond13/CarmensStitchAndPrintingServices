using Csps.Application.Common;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// Builds the detail of the <c>opening-hours.changed</c> audit entry (AUDIT-01): one <c>day=old&gt;new</c> change for each changed
/// weekday, Monday first, such as <c>monday=closed&gt;09:00-18:00</c>. A closed day reads <c>closed</c>. Seven changed days fit well
/// inside the 400-character limit of an audit detail.
/// </summary>
public static class OpeningHoursAuditDetail
{
    private const string Closed = "closed";

    /// <summary>Writes the detail of a save.</summary>
    /// <param name="changes">The changed days.</param>
    /// <returns>The detail text.</returns>
    public static string Changed(IReadOnlyList<OpeningHoursChange> changes)
    {
        ArgumentNullException.ThrowIfNull(changes);
        return AuditDetailFormat.Join(
            [.. changes
                .OrderBy(static change => change.Day)
                .Select(static change => AuditDetailFormat.Change(
                    WeekDay.FromNumber(change.Day).ToString().ToLowerInvariant(),
                    Describe(change.OldOpensAt, change.OldClosesAt),
                    Describe(change.NewOpensAt, change.NewClosesAt)))]);
    }

    private static string Describe(TimeOnly? opensAt, TimeOnly? closesAt) =>
        opensAt is null || closesAt is null ? Closed : $"{DayHoursDto.FormatTime(opensAt)}-{DayHoursDto.FormatTime(closesAt)}";
}
