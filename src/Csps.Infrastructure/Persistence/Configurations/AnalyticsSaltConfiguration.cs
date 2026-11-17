using Csps.Domain.Analytics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the AnalyticsSalts table (ANL-05, D-07): one random 32-byte salt per business day. The day is the key, so two requests that
/// race to make the first salt of a day cannot both win. There is no row version, no JSON column and no trigger (OR-7).
/// </summary>
internal sealed class AnalyticsSaltConfiguration : IEntityTypeConfiguration<AnalyticsSalt>
{
    public void Configure(EntityTypeBuilder<AnalyticsSalt> builder)
    {
        builder.ToTable("AnalyticsSalts");

        builder.HasKey(salt => salt.BusinessDay);
        builder.Property(salt => salt.BusinessDay).HasColumnType("date").ValueGeneratedNever();
        builder.Property(salt => salt.Salt).IsRequired().HasColumnType("binary(32)");
    }
}
