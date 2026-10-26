using Csps.Infrastructure.Persistence.Locking;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the DatabaseLocks table (D-50): the 65 standing lock rows and, in time, short-lived idempotency claims.
/// There is no row version, because a lock row must never cause a 409. The standing rows come from the migration with literal values only.
/// </summary>
internal sealed class DatabaseLockConfiguration : IEntityTypeConfiguration<DatabaseLock>
{
    public void Configure(EntityTypeBuilder<DatabaseLock> builder)
    {
        builder.ToTable("DatabaseLocks");

        builder.HasKey(row => row.Name);
        builder.Property(row => row.Name).IsUnicode(false).HasMaxLength(DatabaseLock.NameMaxLength).ValueGeneratedNever();

        builder.HasIndex(row => row.ExpiresAtUtc).HasDatabaseName("IX_DatabaseLocks_ExpiresAtUtc");

        builder.HasData(DatabaseLocks.StandingNames.Select(name => new { Name = name }));
    }
}
