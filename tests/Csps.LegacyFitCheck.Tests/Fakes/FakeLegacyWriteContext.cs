using Csps.LegacyFitCheck.Source;
using Microsoft.EntityFrameworkCore;

namespace Csps.LegacyFitCheck.Tests.Fakes;

/// <summary>A test-only context over the legacy model that can save, so a test can fill a fake restore with made-up rows.</summary>
internal sealed class FakeLegacyWriteContext(DbContextOptions<FakeLegacyWriteContext> options) : DbContext(options)
{
    public DbSet<LegacyOrderRow> Orders => Set<LegacyOrderRow>();

    public DbSet<LegacyOrderItemRow> OrderItems => Set<LegacyOrderItemRow>();

    public DbSet<LegacyOrderTypeRow> OrderTypes => Set<LegacyOrderTypeRow>();

    public DbSet<LegacyStatusRow> Statuses => Set<LegacyStatusRow>();

    public static FakeLegacyWriteContext Open(string connectionString) =>
        new(new DbContextOptionsBuilder<FakeLegacyWriteContext>().UseSqlServer(connectionString).Options);

    protected override void OnModelCreating(ModelBuilder modelBuilder) => LegacyModel.Configure(modelBuilder);
}
