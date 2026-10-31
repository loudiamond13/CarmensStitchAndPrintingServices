using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the OrderRefunds table (ORD-18, D-07). A refund leaves with its order, and it hides with the order through a matching
/// named query filter, so EF has no required-navigation-to-a-filtered-entity warning. The database checks only that the amount is
/// positive; the 1,000,000.00 cap and the credit and paid caps live in the domain. The refunder index carries the amount and the
/// date, so Phase 10's money on hand reads the index alone (D-08).
/// </summary>
internal sealed class OrderRefundConfiguration : IEntityTypeConfiguration<OrderRefund>
{
    public void Configure(EntityTypeBuilder<OrderRefund> builder)
    {
        builder.ToTable("OrderRefunds", table => table.HasCheckConstraint("CK_OrderRefunds_Amount_Positive", "[Amount] > 0"));

        builder.HasKey(refund => refund.Id);
        builder.Property(refund => refund.Id).ValueGeneratedNever();

        builder.Property(refund => refund.RefundDate).HasColumnType("date");
        builder.Property(refund => refund.Amount).HasPrecision(18, 2);
        builder.Property(refund => refund.Reason).IsRequired().IsUnicode().HasMaxLength(OrderRules.RefundReasonMaxLength);
        builder.Property(refund => refund.CreatedAtUtc).IsRequired();

        builder.HasQueryFilter("SoftDelete", refund => refund.Order.DeletedAtUtc == null);

        // NO ACTION everywhere but the order, so removing a user never rewrites history (SEC-08).
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(refund => refund.RefundedByUserId).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(refund => refund.CreatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(refund => refund.UpdatedById).OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(refund => refund.OrderId).HasDatabaseName("IX_OrderRefunds_OrderId");
        builder.HasIndex(refund => refund.RefundedByUserId)
            .IncludeProperties(refund => new { refund.Amount, refund.RefundDate })
            .HasDatabaseName("IX_OrderRefunds_RefundedByUserId");
        builder.HasIndex(refund => refund.CreatedById).HasDatabaseName("IX_OrderRefunds_CreatedById");
        builder.HasIndex(refund => refund.UpdatedById).HasDatabaseName("IX_OrderRefunds_UpdatedById");
    }
}
