using Csps.Domain.Analytics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the AnalyticsPageViews table (ANL-05): one row per page view of a visit. A visit's rows go with it (cascade), so the 13-month
/// purge of visits leaves no orphan. There is no row version, no JSON column and no trigger (OR-7).
/// </summary>
internal sealed class AnalyticsPageViewConfiguration : IEntityTypeConfiguration<AnalyticsPageView>
{
    public void Configure(EntityTypeBuilder<AnalyticsPageView> builder)
    {
        builder.ToTable("AnalyticsPageViews");

        builder.HasKey(view => view.Id);
        builder.Property(view => view.Id).ValueGeneratedOnAdd();
        builder.Property(view => view.VisitId).IsRequired();
        builder.Property(view => view.BusinessDay).HasColumnType("date");
        builder.Property(view => view.OccurredAtUtc).IsRequired();
        builder.Property(view => view.PageKey).IsRequired().IsUnicode(false).HasMaxLength(PageKeys.MaxLength);

        builder.HasOne<AnalyticsVisit>().WithMany().HasForeignKey(view => view.VisitId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(view => view.VisitId);
        builder.HasIndex(view => view.BusinessDay);
    }
}
