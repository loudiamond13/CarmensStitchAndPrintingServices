using Microsoft.EntityFrameworkCore;

namespace Csps.LegacyFitCheck.Source;

/// <summary>What the restore looked like at one moment: user tables, their rows and the index update count.</summary>
/// <param name="Tables">The number of user tables.</param>
/// <param name="Rows">The rows in all user tables.</param>
/// <param name="UserUpdates">The total user updates the server counted on the restore's indexes.</param>
internal sealed record WriteEvidenceSnapshot(int Tables, long Rows, long UserUpdates);

/// <summary>Whether two snapshots of the restore match.</summary>
internal enum WriteEvidenceVerdict
{
    Unchanged,
    Changed,
}

/// <summary>Before and after proof that the restore was only read (D-14). Built with LINQ over the catalog views.</summary>
internal static class WriteEvidence
{
    private const int HeapIndexId = 0;
    private const int ClusteredIndexId = 1;

    public static async Task<WriteEvidenceSnapshot> CaptureAsync(LegacyDbContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);

        var userTables = context.CatalogTables.Where(table => !table.IsMsShipped);
        var tables = await userTables.CountAsync(cancellationToken).ConfigureAwait(false);
        var rows = await (
            from table in userTables
            join partition in context.CatalogPartitions on table.ObjectId equals partition.ObjectId
            where partition.IndexId == HeapIndexId || partition.IndexId == ClusteredIndexId
            select (long?)partition.Rows).SumAsync(cancellationToken).ConfigureAwait(false);

        // The usage id is widened to int for the compare, so the database id is never narrowed.
        var databaseId = await DatabaseIdAsync(context, context.Database.GetDbConnection().Database, cancellationToken).ConfigureAwait(false);
        var updates = await context.CatalogIndexUsage
            .Where(usage => usage.DatabaseId == databaseId)
            .SumAsync(usage => (long?)usage.UserUpdates, cancellationToken).ConfigureAwait(false);

        return new WriteEvidenceSnapshot(tables, rows ?? 0, updates ?? 0);
    }

    /// <summary>Finds the server's id for the named database. Fails closed when the server does not list exactly one.</summary>
    internal static async Task<int> DatabaseIdAsync(LegacyDbContext context, string databaseName, CancellationToken cancellationToken)
    {
        var ids = await context.CatalogDatabases
            .Where(database => database.Name == databaseName)
            .Select(database => database.DatabaseId)
            .Take(2)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        return ids.Count == 1
            ? ids[0]
            : throw new InvalidOperationException("The database is not in the server's database list, so the index update check cannot run.");
    }

    public static WriteEvidenceVerdict Compare(WriteEvidenceSnapshot before, WriteEvidenceSnapshot after)
    {
        ArgumentNullException.ThrowIfNull(before);
        ArgumentNullException.ThrowIfNull(after);
        return before == after ? WriteEvidenceVerdict.Unchanged : WriteEvidenceVerdict.Changed;
    }
}
