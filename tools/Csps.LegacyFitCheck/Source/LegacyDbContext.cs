using Microsoft.EntityFrameworkCore;

namespace Csps.LegacyFitCheck.Source;

/// <summary>The legacy restore as the check reads it: LINQ reads only, no tracking, and every save is refused.</summary>
internal sealed class LegacyDbContext(DbContextOptions<LegacyDbContext> options) : DbContext(options)
{
    public IQueryable<LegacyOrderRow> Orders => Set<LegacyOrderRow>();

    public IQueryable<LegacyOrderItemRow> OrderItems => Set<LegacyOrderItemRow>();

    public IQueryable<LegacyOrderTypeRow> OrderTypes => Set<LegacyOrderTypeRow>();

    public IQueryable<LegacyStatusRow> Statuses => Set<LegacyStatusRow>();

    public IQueryable<CatalogDatabaseRow> CatalogDatabases => Set<CatalogDatabaseRow>();

    public IQueryable<CatalogTableRow> CatalogTables => Set<CatalogTableRow>();

    public IQueryable<CatalogPartitionRow> CatalogPartitions => Set<CatalogPartitionRow>();

    public IQueryable<CatalogIndexUsageRow> CatalogIndexUsage => Set<CatalogIndexUsageRow>();

    /// <summary>Opens a read context on the given connection string. No logging is attached.</summary>
    public static LegacyDbContext Open(string connectionString) =>
        new(new DbContextOptionsBuilder<LegacyDbContext>()
            .UseSqlServer(connectionString)
            .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)
            .Options);

    public override int SaveChanges() => throw ReadOnly();

    public override int SaveChanges(bool acceptAllChangesOnSuccess) => throw ReadOnly();

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => throw ReadOnly();

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default) => throw ReadOnly();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        LegacyModel.Configure(modelBuilder);
        CatalogViews.Configure(modelBuilder);
    }

    private static InvalidOperationException ReadOnly() => new("The legacy restore is read-only.");
}
