using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the OrderDiscounts table (D-15, ORD-05). A discount leaves with its order, and it hides with the order through a matching
/// named query filter, so EF has no required-navigation-to-a-filtered-entity warning.
/// </summary>
internal sealed class OrderDiscountConfiguration : IEntityTypeConfiguration<OrderDiscount>
{
    public void Configure(EntityTypeBuilder<OrderDiscount> builder)
    {
        builder.ToTable(
            "OrderDiscounts",
            table =>
            {
                table.HasCheckConstraint("CK_OrderDiscounts_Kind", "[Kind] IN (1, 2)");
                table.HasCheckConstraint("CK_OrderDiscounts_Value_Positive", "[Value] > 0");
            });

        builder.HasKey(discount => discount.Id);
        builder.Property(discount => discount.Id).ValueGeneratedNever();

        builder.Property(discount => discount.Kind).HasConversion<byte>().HasColumnType("tinyint");
        builder.Property(discount => discount.Value).HasPrecision(18, 2);
        builder.Property(discount => discount.Reason).IsRequired().IsUnicode().HasMaxLength(OrderRules.DiscountReasonMaxLength);
        builder.Property(discount => discount.CreatedAtUtc).IsRequired();

        builder.HasQueryFilter("SoftDelete", discount => discount.Order.DeletedAtUtc == null);

        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(discount => discount.CreatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(discount => discount.UpdatedById).OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(discount => discount.OrderId).HasDatabaseName("IX_OrderDiscounts_OrderId");
        builder.HasIndex(discount => discount.CreatedById).HasDatabaseName("IX_OrderDiscounts_CreatedById");
        builder.HasIndex(discount => discount.UpdatedById).HasDatabaseName("IX_OrderDiscounts_UpdatedById");
    }
}
