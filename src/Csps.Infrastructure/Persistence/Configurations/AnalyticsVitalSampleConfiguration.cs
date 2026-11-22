using Csps.Domain.Analytics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the AnalyticsVitalSamples table (ANL-05, D-26): one row per measured metric of a visit. A visit's rows go with it (cascade).
/// Nothing writes or reads it any more (D-80). The indexes are kept because the schema stays, not because a reader uses them.
/// No row version, no JSON column, no trigger (OR-7).
/// </summary>
internal sealed class AnalyticsVitalSampleConfiguration : IEntityTypeConfiguration<AnalyticsVitalSample>
{
    public void Configure(EntityTypeBuilder<AnalyticsVitalSample> builder)
    {
        builder.ToTable("AnalyticsVitalSamples");

        builder.HasKey(sample => sample.Id);
        builder.Property(sample => sample.Id).ValueGeneratedOnAdd();
        builder.Property(sample => sample.VisitId).IsRequired();
        builder.Property(sample => sample.BusinessDay).HasColumnType("date");
        builder.Property(sample => sample.Metric).IsRequired();
        builder.Property(sample => sample.Value).IsRequired().HasPrecision(9, AnalyticsVitalSample.Scale);
        builder.Property(sample => sample.PageKey).IsRequired().IsUnicode(false).HasMaxLength(PageKeys.MaxLength);

        builder.HasOne<AnalyticsVisit>().WithMany().HasForeignKey(sample => sample.VisitId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(sample => sample.VisitId);
        builder.HasIndex(sample => new { sample.BusinessDay, sample.Metric, sample.Value });
    }
}
