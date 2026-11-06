using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the OrderImages table (ORD-04, IMG-03). The 5-photo guard needs no trigger (OR-7): <c>Slot</c> is limited to 0 to 4 and unique
/// per order, so a sixth row cannot exist, while <c>Position</c> is the display order, limited to 0 to 4 and not unique so a swap of
/// two photos never trips an index. A photo leaves with its order, and it hides with the order through a matching named query filter.
/// </summary>
internal sealed class OrderImageConfiguration : IEntityTypeConfiguration<OrderImage>
{
    public void Configure(EntityTypeBuilder<OrderImage> builder)
    {
        builder.ToTable(
            "OrderImages",
            table =>
            {
                table.HasCheckConstraint("CK_OrderImages_Slot_Range", "[Slot] BETWEEN 0 AND 4");
                table.HasCheckConstraint("CK_OrderImages_Position_Range", "[Position] BETWEEN 0 AND 4");
            });

        builder.HasKey(image => image.Id);
        builder.Property(image => image.Id).ValueGeneratedNever();

        builder.Property(image => image.Slot).HasConversion<byte>();
        builder.Property(image => image.PublicId).IsRequired().IsUnicode().HasMaxLength(200);
        builder.Property(image => image.Format).IsRequired().IsUnicode(false).HasMaxLength(8);
        builder.Property(image => image.Description).IsUnicode().HasMaxLength(OrderImageRules.DescriptionMaxLength);
        builder.Property(image => image.CreatedAtUtc).IsRequired();

        builder.HasQueryFilter("SoftDelete", image => image.Order.DeletedAtUtc == null);

        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(image => image.CreatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(image => image.UpdatedById).OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(image => new { image.OrderId, image.Slot }).IsUnique().HasDatabaseName("IX_OrderImages_OrderId_Slot");
        builder.HasIndex(image => image.PublicId).IsUnique().HasDatabaseName("IX_OrderImages_PublicId");

        // The order list reads the cover and the photo count of many orders at once.
        builder.HasIndex(image => new { image.OrderId, image.Position })
            .IncludeProperties(image => new { image.PublicId, image.Width, image.Height })
            .HasDatabaseName("IX_OrderImages_OrderId_Position");
        builder.HasIndex(image => image.CreatedById).HasDatabaseName("IX_OrderImages_CreatedById");
        builder.HasIndex(image => image.UpdatedById).HasDatabaseName("IX_OrderImages_UpdatedById");
    }
}
