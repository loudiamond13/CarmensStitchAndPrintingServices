using Csps.Domain.Content;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the holidays and closures (CONT-04, D-21). The rules that fit one row live in CHECK constraints, not triggers (OR-7): the last
/// day is on or after the first, and a closure is at most 31 days. Overlaps between rows are decided by the handlers under the
/// site-content lock. The days are <c>date</c> columns.
/// </summary>
internal sealed class ShopClosureConfiguration : IEntityTypeConfiguration<ShopClosure>
{
    public void Configure(EntityTypeBuilder<ShopClosure> builder)
    {
        builder.ToTable("ShopClosures", table =>
        {
            table.HasCheckConstraint("CK_ShopClosures_LastOnOrAfterFirst", "[LastDay] >= [FirstDay]");
            table.HasCheckConstraint("CK_ShopClosures_Span", $"DATEDIFF(day, [FirstDay], [LastDay]) < {ShopClosure.MaxSpanDays}");
        });

        builder.HasKey(closure => closure.Id);
        builder.Property(closure => closure.Id).ValueGeneratedNever();

        builder.Property(closure => closure.FirstDay).HasColumnType("date");
        builder.Property(closure => closure.LastDay).HasColumnType("date");
        builder.Property(closure => closure.Note).HasMaxLength(ShopClosure.NoteMaxLength);
        builder.Property(closure => closure.CreatedAtUtc).IsRequired();
        builder.Property(closure => closure.RowVersion).IsRowVersion();

        builder.Ignore(closure => closure.Span);

        // The upcoming list and the public reads filter on the last day.
        builder.HasIndex(closure => closure.LastDay).HasDatabaseName("IX_ShopClosures_LastDay");
    }
}
