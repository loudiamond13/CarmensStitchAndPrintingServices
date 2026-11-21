using Csps.Domain.Analytics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the DailyDeviceCounts table (ANL-09): one row per business day, dimension (device or browser) and label. Nothing writes it any more
/// (D-80); the retention job only deletes old rows. No row version, no JSON column, no trigger (OR-7), no column that could identify a visitor.
/// </summary>
internal sealed class DailyDeviceCountConfiguration : IEntityTypeConfiguration<DailyDeviceCount>
{
    public void Configure(EntityTypeBuilder<DailyDeviceCount> builder)
    {
        builder.ToTable("DailyDeviceCounts");

        builder.HasKey(row => new { row.BusinessDay, row.Dimension, row.Name });
        builder.Property(row => row.BusinessDay).HasColumnType("date");
        builder.Property(row => row.Dimension).IsRequired();
        builder.Property(row => row.Name).IsRequired().IsUnicode(false).HasMaxLength(AnalyticsVisit.LabelMaxLength);
        builder.Property(row => row.Visits).IsRequired();
    }
}
