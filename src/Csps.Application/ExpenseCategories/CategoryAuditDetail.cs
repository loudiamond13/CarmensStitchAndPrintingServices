using Csps.Application.Common;

namespace Csps.Application.ExpenseCategories;

/// <summary>Builds the audit detail of category events (D-27). Names are free text, so <see cref="AuditDetailFormat"/> percent-encodes them.</summary>
public static class CategoryAuditDetail
{
    /// <summary>Writes the detail of an added category: <c>name=…;tone=…</c>.</summary>
    /// <param name="name">The name.</param>
    /// <param name="tone">The tone.</param>
    /// <returns>The detail text.</returns>
    public static string Added(string name, string tone) =>
        AuditDetailFormat.Join(AuditDetailFormat.Pair("name", name), AuditDetailFormat.Pair("tone", tone));

    /// <summary>Writes the detail of a rename: <c>name=&lt;old&gt;&gt;&lt;new&gt;</c>.</summary>
    /// <param name="from">The old name.</param>
    /// <param name="to">The new name.</param>
    /// <returns>The detail text.</returns>
    public static string Renamed(string from, string to) => AuditDetailFormat.Change("name", from, to);

    /// <summary>Writes the detail of a recolor: <c>tone=&lt;old&gt;&gt;&lt;new&gt;</c>.</summary>
    /// <param name="from">The old tone.</param>
    /// <param name="to">The new tone.</param>
    /// <returns>The detail text.</returns>
    public static string Recolored(string from, string to) => AuditDetailFormat.Change("tone", from, to);

    /// <summary>Writes the detail of a retire, reactivate or delete: <c>name=…</c>.</summary>
    /// <param name="name">The name.</param>
    /// <returns>The detail text.</returns>
    public static string NameOnly(string name) => AuditDetailFormat.Pair("name", name);
}
