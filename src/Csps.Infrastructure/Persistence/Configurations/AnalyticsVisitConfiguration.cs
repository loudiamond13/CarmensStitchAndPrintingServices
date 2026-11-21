using Csps.Domain.Analytics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the AnalyticsVisits table (ANL-05): one row per visit. Nothing writes or reads it any more (D-56, D-80); the retention job only
/// deletes old rows. Any visitor id and address are stored only as 32-byte hashes. No row version, no JSON column, no trigger (OR-7).
/// The indexes are kept because the schema stays (D-80), not because a reader uses them.
/// </summary>
internal sealed class AnalyticsVisitConfiguration : IEntityTypeConfiguration<AnalyticsVisit>
{
    public void Configure(EntityTypeBuilder<AnalyticsVisit> builder)
    {
        builder.ToTable("AnalyticsVisits");

        builder.HasKey(visit => visit.Id);
        builder.Property(visit => visit.Id).ValueGeneratedNever();
        builder.Property(visit => visit.VisitorHash).IsRequired().HasColumnType("binary(32)");
        builder.Property(visit => visit.BusinessDay).HasColumnType("date");
        builder.Property(visit => visit.StartedAtUtc).IsRequired();
        builder.Property(visit => visit.LastSeenAtUtc).IsRequired();
        builder.Property(visit => visit.Referrer).IsRequired().IsUnicode(false).HasMaxLength(ReferrerName.MaxLength);
        builder.Property(visit => visit.Device).IsRequired();
        builder.Property(visit => visit.Browser).IsRequired().IsUnicode(false).HasMaxLength(AnalyticsVisit.LabelMaxLength);
        builder.Property(visit => visit.Os).IsRequired().IsUnicode(false).HasMaxLength(AnalyticsVisit.LabelMaxLength);
        builder.Property(visit => visit.IpHash).HasColumnType("binary(32)");
        builder.Property(visit => visit.PageViews).IsRequired();

        builder.HasIndex(visit => new { visit.VisitorHash, visit.LastSeenAtUtc });
        builder.HasIndex(visit => visit.BusinessDay).IncludeProperties(visit => new { visit.VisitorHash, visit.Referrer, visit.Device, visit.Browser });
    }
}
