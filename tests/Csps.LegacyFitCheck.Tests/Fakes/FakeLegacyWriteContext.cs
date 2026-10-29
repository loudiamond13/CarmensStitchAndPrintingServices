using Csps.LegacyFitCheck.Source;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Csps.LegacyFitCheck.Tests.Fakes;

/// <summary>An extra text column on a fake legacy table, added through EF model config as a shadow property.</summary>
/// <param name="Table">The table name.</param>
/// <param name="Column">The column name.</param>
internal sealed record ShadowColumn(string Table, string Column);

/// <summary>A test-only context over the legacy model that can save, so a test can fill a fake restore with made-up rows.</summary>
internal sealed class FakeLegacyWriteContext : DbContext
{
    private readonly IReadOnlyList<ShadowColumn> _shadowColumns;
    private readonly IReadOnlyList<ShadowColumn> _missingColumns;

    private FakeLegacyWriteContext(DbContextOptions<FakeLegacyWriteContext> options, IReadOnlyList<ShadowColumn> shadowColumns, IReadOnlyList<ShadowColumn> missingColumns)
        : base(options)
    {
        _shadowColumns = shadowColumns;
        _missingColumns = missingColumns;
    }

    public DbSet<LegacyOrderRow> Orders => Set<LegacyOrderRow>();

    public DbSet<LegacyOrderItemRow> OrderItems => Set<LegacyOrderItemRow>();

    public DbSet<LegacyPaymentRow> Payments => Set<LegacyPaymentRow>();

    public DbSet<LegacyDiscountRow> Discounts => Set<LegacyDiscountRow>();

    public DbSet<LegacyExpenseRow> Expenses => Set<LegacyExpenseRow>();

    public DbSet<LegacyUserRow> Users => Set<LegacyUserRow>();

    public DbSet<LegacyRoleRow> Roles => Set<LegacyRoleRow>();

    public DbSet<LegacyUserRoleRow> UserRoles => Set<LegacyUserRoleRow>();

    public DbSet<LegacyOrderTypeRow> OrderTypes => Set<LegacyOrderTypeRow>();

    public DbSet<LegacyStatusRow> Statuses => Set<LegacyStatusRow>();

    internal string ShadowKey =>
        string.Join(',', _shadowColumns.Select(static column => $"{column.Table}.{column.Column}")) + "|"
        + string.Join(',', _missingColumns.Select(static column => $"{column.Table}.{column.Column}"));

    public static FakeLegacyWriteContext Open(string connectionString, IReadOnlyList<ShadowColumn>? shadowColumns = null, IReadOnlyList<ShadowColumn>? missingColumns = null) =>
        new(
            new DbContextOptionsBuilder<FakeLegacyWriteContext>()
                .UseSqlServer(connectionString)
                .ReplaceService<IModelCacheKeyFactory, ShadowModelCacheKeyFactory>()
                .Options,
            shadowColumns ?? [],
            missingColumns ?? []);

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        LegacyModel.Configure(modelBuilder);
        foreach (var shadow in _shadowColumns)
        {
            var entity = modelBuilder.Model.GetEntityTypes().Single(type => type.GetTableName() == shadow.Table);
            modelBuilder.Entity(entity.ClrType).Property<string>(shadow.Column).HasMaxLength(50);
        }

        // A missing column is left out of the table, as drift in a restore would.
        foreach (var missing in _missingColumns)
        {
            var entity = modelBuilder.Model.GetEntityTypes().Single(type => type.GetTableName() == missing.Table);
            var property = entity.GetProperties().Single(property => property.GetColumnName() == missing.Column);
            modelBuilder.Entity(entity.ClrType).Ignore(property.Name);
        }
    }

    /// <summary>Gives each set of shadow and missing columns its own cached model.</summary>
    private sealed class ShadowModelCacheKeyFactory : IModelCacheKeyFactory
    {
        public object Create(DbContext context, bool designTime) =>
            (context.GetType(), designTime, (context as FakeLegacyWriteContext)?.ShadowKey);
    }
}
