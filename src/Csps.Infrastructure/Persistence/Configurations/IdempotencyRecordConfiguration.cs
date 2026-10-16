using Csps.Infrastructure.Idempotency;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the stored answers of idempotent POSTs (SEC-06, D-40). The unique index on (Key, Route, UserId) treats the
/// null user of anonymous callers as one value, so an anonymous key is unique per route. The body is plain nvarchar.
/// </summary>
internal sealed class IdempotencyRecordConfiguration : IEntityTypeConfiguration<IdempotencyRecord>
{
    public void Configure(EntityTypeBuilder<IdempotencyRecord> builder)
    {
        builder.ToTable("IdempotencyRecords");

        builder.HasKey(record => record.Id);
        builder.Property(record => record.Id).ValueGeneratedOnAdd();

        builder.Property(record => record.Route).IsRequired().IsUnicode(false).HasMaxLength(IdempotencyRecord.RouteMaxLength);
        builder.Property(record => record.RequestHash).IsRequired().HasColumnType("binary(32)");
        builder.Property(record => record.ResponseBody).IsUnicode();
        builder.Property(record => record.ResponseContentType).IsUnicode(false).HasMaxLength(IdempotencyRecord.ContentTypeMaxLength);
        builder.Property(record => record.Location).IsUnicode(false).HasMaxLength(IdempotencyRecord.LocationMaxLength);

        // No filter: a filtered index would let two anonymous records with the same key and route both exist.
        builder.HasIndex(record => new { record.Key, record.Route, record.UserId })
            .IsUnique()
            .HasFilter(null)
            .HasDatabaseName("UX_IdempotencyRecords_Key_Route_UserId");

        // The purge job (JOB-01) deletes by expiry.
        builder.HasIndex(record => record.ExpiresAt).HasDatabaseName("IX_IdempotencyRecords_ExpiresAt");
    }
}
