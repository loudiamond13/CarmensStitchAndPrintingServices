using Csps.Application.ExpenseCategories;

namespace Csps.Application.OrderLists;

/// <summary>Builds the audit detail of order list events (D-31). It uses the same keys as the category events, so the audit viewer reads them alike.</summary>
public static class OrderListAuditDetail
{
    /// <summary>Writes the detail of an added entry: <c>name=…;tone=…</c>.</summary>
    /// <param name="name">The name.</param>
    /// <param name="tone">The tone.</param>
    /// <returns>The detail text.</returns>
    public static string Added(string name, string tone) => CategoryAuditDetail.Added(name, tone);

    /// <summary>Writes the detail of a rename: <c>name=&lt;old&gt;&gt;&lt;new&gt;</c>.</summary>
    /// <param name="from">The old name.</param>
    /// <param name="to">The new name.</param>
    /// <returns>The detail text.</returns>
    public static string Renamed(string from, string to) => CategoryAuditDetail.Renamed(from, to);

    /// <summary>Writes the detail of a recolor: <c>tone=&lt;old&gt;&gt;&lt;new&gt;</c>.</summary>
    /// <param name="from">The old tone.</param>
    /// <param name="to">The new tone.</param>
    /// <returns>The detail text.</returns>
    public static string Recolored(string from, string to) => CategoryAuditDetail.Recolored(from, to);

    /// <summary>Writes the detail of a retire, reactivate or delete: <c>name=…</c>.</summary>
    /// <param name="name">The name.</param>
    /// <returns>The detail text.</returns>
    public static string NameOnly(string name) => CategoryAuditDetail.NameOnly(name);
}
