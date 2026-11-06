using Csps.Infrastructure.Maintenance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the MaintenanceCursors table (D-54): one row per job holding its listing place. There is no row version (only the run that holds
/// the maintenance lease writes it), no JSON column and no trigger (OR-7).
/// </summary>
internal sealed class MaintenanceCursorConfiguration : IEntityTypeConfiguration<MaintenanceCursor>
{
    public void Configure(EntityTypeBuilder<MaintenanceCursor> builder)
    {
        builder.ToTable("MaintenanceCursors");

        builder.HasKey(row => row.JobName);
        builder.Property(row => row.JobName).IsUnicode(false).HasMaxLength(MaintenanceCursor.JobNameMaxLength).ValueGeneratedNever();
        builder.Property(row => row.Position).IsRequired().IsUnicode().HasMaxLength(MaintenanceCursor.CursorMaxLength);
        builder.Property(row => row.UpdatedAtUtc).IsRequired();
    }
}
