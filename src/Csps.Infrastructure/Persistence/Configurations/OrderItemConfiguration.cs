using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the OrderItems table (ORD-13). A line leaves with its order, and it hides with the order through a matching named query
/// filter, so EF has no required-navigation-to-a-filtered-entity warning.
/// </summary>
internal sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.ToTable(
            "OrderItems",
            table =>
            {
                table.HasCheckConstraint("CK_OrderItems_Quantity_NonNegative", "[Quantity] >= 0");
                table.HasCheckConstraint("CK_OrderItems_UnitPrice_NonNegative", "[UnitPrice] >= 0");
            });

        builder.HasKey(item => item.Id);
        builder.Property(item => item.Id).ValueGeneratedNever();

        builder.Property(item => item.Description).IsRequired().IsUnicode().HasMaxLength(OrderRules.ItemDescriptionMaxLength);
        builder.Property(item => item.SizeVariant).IsUnicode().HasMaxLength(OrderRules.SizeVariantMaxLength);
        builder.Property(item => item.UnitPrice).HasPrecision(18, 2);
        builder.Property(item => item.LineTotal).HasPrecision(18, 2);
        builder.Property(item => item.CreatedAtUtc).IsRequired();

        builder.HasQueryFilter("SoftDelete", item => item.Order.DeletedAtUtc == null);

        builder.HasOne<ProductType>().WithMany().HasForeignKey(item => item.ProductTypeId).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(item => item.CreatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(item => item.UpdatedById).OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(item => item.OrderId).HasDatabaseName("IX_OrderItems_OrderId");
        builder.HasIndex(item => item.ProductTypeId).HasDatabaseName("IX_OrderItems_ProductTypeId");
        builder.HasIndex(item => item.CreatedById).HasDatabaseName("IX_OrderItems_CreatedById");
        builder.HasIndex(item => item.UpdatedById).HasDatabaseName("IX_OrderItems_UpdatedById");
    }
}
