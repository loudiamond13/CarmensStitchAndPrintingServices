using Csps.Domain.Analytics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the DailyDeviceCounts table (ANL-09): one row per business day, dimension (device or browser) and label. The retention job replaces
/// a day's rows when it rolls the day up, so there is no row version. No JSON column, no trigger (OR-7), no column that could identify a visitor.
/// </summary>
internal sealed class DailyDeviceCountConfiguration : IEntityTypeConfiguration<DailyDeviceCount>
{
    public void Configure(EntityTypeBuilder<DailyDeviceCount> builder)
    {
        builder.ToTable("DailyDeviceCounts");

        builder.HasKey(row => new { row.BusinessDay, row.Dimension, row.Name });
        builder.Property(row => row.BusinessDay).HasColumnType("date");
        builder.Property(row => row.Dimension).IsRequired().HasConversion<byte>();
        builder.Property(row => row.Name).IsRequired().IsUnicode(false).HasMaxLength(AnalyticsVisit.LabelMaxLength);
        builder.Property(row => row.Visits).IsRequired();
    }
}
