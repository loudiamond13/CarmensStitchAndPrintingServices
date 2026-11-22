using Csps.Domain.Analytics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the DailyReferrerCounts table (ANL-09): one row per business day and source name. The retention job replaces a day's rows when it
/// rolls the day up, so there is no row version. No JSON column, no trigger (OR-7), no column that could identify a visitor.
/// </summary>
internal sealed class DailyReferrerCountConfiguration : IEntityTypeConfiguration<DailyReferrerCount>
{
    public void Configure(EntityTypeBuilder<DailyReferrerCount> builder)
    {
        builder.ToTable("DailyReferrerCounts");

        builder.HasKey(row => new { row.BusinessDay, row.Referrer });
        builder.Property(row => row.BusinessDay).HasColumnType("date");
        builder.Property(row => row.Referrer).IsRequired().IsUnicode(false).HasMaxLength(ReferrerName.MaxLength);
        builder.Property(row => row.Visits).IsRequired();
    }
}
