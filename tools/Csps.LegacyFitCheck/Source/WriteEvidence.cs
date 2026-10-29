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

        var databaseName = context.Database.GetDbConnection().Database;
        var databaseId = (short)await context.CatalogDatabases
            .Where(database => database.Name == databaseName)
            .Select(database => database.DatabaseId)
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        var updates = await context.CatalogIndexUsage
            .Where(usage => usage.DatabaseId == databaseId)
            .SumAsync(usage => (long?)usage.UserUpdates, cancellationToken).ConfigureAwait(false);

        return new WriteEvidenceSnapshot(tables, rows ?? 0, updates ?? 0);
    }

    public static WriteEvidenceVerdict Compare(WriteEvidenceSnapshot before, WriteEvidenceSnapshot after)
    {
        ArgumentNullException.ThrowIfNull(before);
        ArgumentNullException.ThrowIfNull(after);
        return before == after ? WriteEvidenceVerdict.Unchanged : WriteEvidenceVerdict.Changed;
    }
}
