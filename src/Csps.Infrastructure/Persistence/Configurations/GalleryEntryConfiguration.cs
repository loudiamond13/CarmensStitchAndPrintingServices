using System.Globalization;
using Csps.Domain.Content;
using Csps.Domain.Orders;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the gallery entries (D-10, GAL-03): the one manual order shared by shown orders and direct uploads. The rules that fit one row live
/// in CHECK constraints, not triggers (OR-7): an order entry names its order, an upload holds its photo, team and line and no order, and
/// the pieces are 1 to 9,999. An order has at most one entry (a filtered unique index). The position is not unique, because a swap would
/// collide in the middle of the update. Removing an order removes its entry; a line that has entries cannot be deleted. No row is ever
/// inserted by the migration.
/// </summary>
internal sealed class GalleryEntryConfiguration : IEntityTypeConfiguration<GalleryEntry>
{
    public void Configure(EntityTypeBuilder<GalleryEntry> builder)
    {
        builder.ToTable("GalleryEntries", table =>
        {
            table.HasCheckConstraint(
                "CK_GalleryEntries_Kind",
                "([Kind] = 'Order' AND [OrderId] IS NOT NULL) OR ([Kind] = 'Upload' AND [OrderId] IS NULL AND [PublicId] IS NOT NULL AND [TeamName] IS NOT NULL AND [ProductLineId] IS NOT NULL)");
            table.HasCheckConstraint(
                "CK_GalleryEntries_Pieces",
                string.Create(CultureInfo.InvariantCulture, $"[Pieces] IS NULL OR [Pieces] BETWEEN {GalleryEntry.MinPieces} AND {GalleryEntry.MaxPieces}"));
        });

        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.Id).ValueGeneratedNever();

        builder.Property(entry => entry.Kind).HasConversion<string>().IsRequired().IsUnicode(false).HasMaxLength(10);
        builder.Property(entry => entry.PublicId).IsUnicode().HasMaxLength(GalleryEntry.PublicIdMaxLength);
        builder.Property(entry => entry.Format).IsUnicode(false).HasMaxLength(GalleryEntry.FormatMaxLength);
        builder.Property(entry => entry.TeamName).IsUnicode().HasMaxLength(GalleryEntry.TeamNameMaxLength);
        builder.Property(entry => entry.Note).IsUnicode().HasMaxLength(GalleryEntry.NoteMaxLength);
        builder.Property(entry => entry.CreatedAtUtc).IsRequired();
        builder.Property(entry => entry.RowVersion).IsRowVersion();

        builder.HasOne<Order>().WithMany().HasForeignKey(entry => entry.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<ProductLine>().WithMany().HasForeignKey(entry => entry.ProductLineId).OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(entry => entry.OrderId).IsUnique().HasFilter("[OrderId] IS NOT NULL").HasDatabaseName("UX_GalleryEntries_OrderId");
        builder.HasIndex(entry => entry.ProductLineId).HasDatabaseName("IX_GalleryEntries_ProductLineId");

        // The public read and the Manager's list read the entries in gallery order.
        builder.HasIndex(entry => new { entry.Position, entry.Id }).HasDatabaseName("IX_GalleryEntries_Position");
    }
}
