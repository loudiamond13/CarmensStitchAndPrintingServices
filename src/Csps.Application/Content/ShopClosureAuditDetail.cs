using Csps.Application.Common;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// Builds the detail of the <c>shop-closure.*</c> audit entries (AUDIT-01): <c>first=</c> and <c>last=</c> hold the days, written
/// <c>old&gt;new</c> when a change moved them. The note is never copied (D-06): <c>fields=note</c> only says that a note was set or changed.
/// </summary>
public static class ShopClosureAuditDetail
{
    /// <summary>The target type of every closure audit entry.</summary>
    public const string TargetType = "ShopClosure";

    private const string NoteField = "note";

    /// <summary>Writes the detail of an added closure.</summary>
    /// <param name="closure">The new closure.</param>
    /// <returns>The detail text.</returns>
    public static string Added(ShopClosure closure)
    {
        ArgumentNullException.ThrowIfNull(closure);
        return closure.Note is null
            ? AuditDetailFormat.Join(AuditDetailFormat.Pair("first", closure.FirstDay), AuditDetailFormat.Pair("last", closure.LastDay))
            : AuditDetailFormat.Join(AuditDetailFormat.Pair("first", closure.FirstDay), AuditDetailFormat.Pair("last", closure.LastDay), AuditDetailFormat.Pair("fields", NoteField));
    }

    /// <summary>Writes the detail of a changed closure.</summary>
    /// <param name="change">What changed.</param>
    /// <returns>The detail text.</returns>
    public static string Changed(ShopClosureChange change)
    {
        ArgumentNullException.ThrowIfNull(change);
        var parts = new List<string>
        {
            Day("first", change.OldFirstDay, change.NewFirstDay),
            Day("last", change.OldLastDay, change.NewLastDay),
        };
        if (change.NoteChanged)
        {
            parts.Add(AuditDetailFormat.Pair("fields", NoteField));
        }

        return AuditDetailFormat.Join([.. parts]);
    }

    /// <summary>Writes the detail of a deleted closure.</summary>
    /// <param name="closure">The closure that is removed.</param>
    /// <returns>The detail text.</returns>
    public static string Deleted(ShopClosure closure)
    {
        ArgumentNullException.ThrowIfNull(closure);
        return AuditDetailFormat.Join(AuditDetailFormat.Pair("first", closure.FirstDay), AuditDetailFormat.Pair("last", closure.LastDay));
    }

    private static string Day(string key, DateOnly oldDay, DateOnly newDay) =>
        oldDay == newDay ? AuditDetailFormat.Pair(key, newDay) : AuditDetailFormat.Change(key, oldDay, newDay);
}
