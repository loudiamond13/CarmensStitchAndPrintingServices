using Csps.Domain.Content;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the product line photos (D-02). The slot is stored as a number from 0 (main) to 2 (fabric detail) and a line has at most one
/// photo in each, so the slot guard needs no trigger (OR-7). A line that has photos cannot be deleted.
/// </summary>
internal sealed class ProductLinePhotoConfiguration : IEntityTypeConfiguration<ProductLinePhoto>
{
    public void Configure(EntityTypeBuilder<ProductLinePhoto> builder)
    {
        builder.ToTable("ProductLinePhotos", table => table.HasCheckConstraint("CK_ProductLinePhotos_Slot", "[Slot] BETWEEN 0 AND 2"));

        builder.HasKey(photo => photo.Id);
        builder.Property(photo => photo.Id).ValueGeneratedNever();

        builder.Property(photo => photo.Slot).HasConversion<byte>();
        builder.Property(photo => photo.PublicId).IsRequired().IsUnicode().HasMaxLength(200);
        builder.Property(photo => photo.Format).IsRequired().IsUnicode(false).HasMaxLength(8);
        builder.Property(photo => photo.CreatedAtUtc).IsRequired();

        builder.HasOne<ProductLine>().WithMany().HasForeignKey(photo => photo.LineId).OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(photo => new { photo.LineId, photo.Slot }).IsUnique().HasDatabaseName("UX_ProductLinePhotos_LineSlot");
    }
}
