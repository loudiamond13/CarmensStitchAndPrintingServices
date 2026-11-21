using Csps.Domain.Analytics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the AnalyticsVisits table (ANL-05): one row per visit of a visitor who allowed stats. The visitor id and the address are
/// stored only as 32-byte hashes. There is no row version (counters change through <c>ExecuteUpdate</c>), no JSON column and no trigger
/// (OR-7). The first index finds a visitor's current visit; the second serves the day roll-ups without touching the table.
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
