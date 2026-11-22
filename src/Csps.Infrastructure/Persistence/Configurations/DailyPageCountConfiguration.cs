using Csps.Domain.Analytics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the DailyPageCounts table (ANL-06): one row per business day and page key. The key is the pair, so the count is kept by one atomic
/// update. There is no row version (the count changes only through <c>ExecuteUpdate</c>), no JSON column and no trigger (OR-7), and no
/// column that could identify a visitor.
/// </summary>
internal sealed class DailyPageCountConfiguration : IEntityTypeConfiguration<DailyPageCount>
{
    public void Configure(EntityTypeBuilder<DailyPageCount> builder)
    {
        builder.ToTable("DailyPageCounts");

        builder.HasKey(row => new { row.BusinessDay, row.PageKey });
        builder.Property(row => row.BusinessDay).HasColumnType("date");
        builder.Property(row => row.PageKey).IsRequired().IsUnicode(false).HasMaxLength(PageKeys.MaxLength);
        builder.Property(row => row.Views).IsRequired();
    }
}
