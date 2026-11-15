using Csps.Domain.Content;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the weekly opening hours (D-21): seven rows keyed by weekday, 1 for Monday to 7 for Sunday. The rows come from the migration with
/// every day closed, never from the model, so no hours are invented. The rules live in CHECK constraints, not triggers (OR-7): a day
/// has both times or neither, and the closing time is after the opening time. Times are <c>time(0)</c>, whole seconds.
/// </summary>
internal sealed class OpeningHoursConfiguration : IEntityTypeConfiguration<OpeningHours>
{
    public void Configure(EntityTypeBuilder<OpeningHours> builder)
    {
        builder.ToTable("OpeningHours", table =>
        {
            table.HasCheckConstraint("CK_OpeningHours_Day", $"[DayOfWeek] BETWEEN {OpeningHours.FirstDay} AND {OpeningHours.LastDay}");
            table.HasCheckConstraint(
                "CK_OpeningHours_BothOrNone",
                "([OpensAt] IS NULL AND [ClosesAt] IS NULL) OR ([OpensAt] IS NOT NULL AND [ClosesAt] IS NOT NULL)");
            table.HasCheckConstraint("CK_OpeningHours_ClosesAfterOpens", "[OpensAt] IS NULL OR [ClosesAt] > [OpensAt]");
        });

        builder.HasKey(hours => hours.DayOfWeek);
        builder.Property(hours => hours.DayOfWeek).ValueGeneratedNever();

        builder.Property(hours => hours.OpensAt).HasColumnType("time(0)");
        builder.Property(hours => hours.ClosesAt).HasColumnType("time(0)");
        builder.Property(hours => hours.CreatedAtUtc).IsRequired();
        builder.Property(hours => hours.RowVersion).IsRowVersion();
    }
}
