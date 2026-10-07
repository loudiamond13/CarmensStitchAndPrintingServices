using Csps.Domain.Auditing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the append-only audit log (FND-10, research Pattern 9). The table carries the trigger
/// <c>TR_AuditLog_AppendOnly</c>, created by the AddAuditLog migration, which rejects UPDATE (error 51000) and DELETE
/// (error 51001). SQL Server refuses an <c>OUTPUT</c> clause without <c>INTO</c> on a table with enabled triggers, so
/// EF must not use one here (research Pitfall 2).
/// </summary>
internal sealed class AuditEntryConfiguration : IEntityTypeConfiguration<AuditEntry>
{
    /// <summary>The name of the append-only trigger on <c>dbo.AuditLog</c>.</summary>
    public const string TriggerName = "TR_AuditLog_AppendOnly";

    public void Configure(EntityTypeBuilder<AuditEntry> builder)
    {
        builder.ToTable("AuditLog", table =>
        {
            table.HasTrigger(TriggerName);
            table.UseSqlOutputClause(false);
        });

        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.Id).UseIdentityColumn();

        builder.Property(entry => entry.OccurredAtUtc).IsRequired();
        builder.Property(entry => entry.Action).IsRequired().IsUnicode().HasMaxLength(AuditEntry.ActionMaxLength);
        builder.Property(entry => entry.TargetType).IsUnicode().HasMaxLength(AuditEntry.TargetTypeMaxLength);
        builder.Property(entry => entry.TargetId).IsUnicode().HasMaxLength(AuditEntry.TargetIdMaxLength);
        builder.Property(entry => entry.IpPrefix).IsUnicode().HasMaxLength(AuditEntry.IpPrefixMaxLength);
        builder.Property(entry => entry.UserAgentFamily).IsUnicode().HasMaxLength(AuditEntry.UserAgentFamilyMaxLength);

        // A W3C trace id: always 32 lowercase hex characters, so ASCII storage is enough.
        builder.Property(entry => entry.CorrelationId).IsRequired().IsUnicode(false).HasMaxLength(AuditEntry.CorrelationIdLength);
        builder.Property(entry => entry.Detail).IsUnicode().HasMaxLength(AuditEntry.DetailMaxLength);

        // Supports the retention purge (rows older than 8 months, D-32) and time-ordered reads.
        builder.HasIndex(entry => entry.OccurredAtUtc).HasDatabaseName("IX_AuditLog_OccurredAtUtc");
    }
}
