using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the OrderPayments table (ORD-05, ORD-22). A payment leaves with its order, and it hides with the order through a matching
/// named query filter, so EF has no required-navigation-to-a-filtered-entity warning. The database checks only that the amount is
/// positive; the 1,000,000.00 cap and the balance rule live in the domain. The receiver index carries the amount and the date, so
/// Phase 10's money on hand reads the index alone.
/// </summary>
internal sealed class OrderPaymentConfiguration : IEntityTypeConfiguration<OrderPayment>
{
    public void Configure(EntityTypeBuilder<OrderPayment> builder)
    {
        builder.ToTable("OrderPayments", table => table.HasCheckConstraint("CK_OrderPayments_Amount_Positive", "[Amount] > 0"));

        builder.HasKey(payment => payment.Id);
        builder.Property(payment => payment.Id).ValueGeneratedNever();

        builder.Property(payment => payment.PaymentDate).HasColumnType("date");
        builder.Property(payment => payment.Amount).HasPrecision(18, 2);
        builder.Property(payment => payment.Reference).IsUnicode().HasMaxLength(OrderRules.PaymentReferenceMaxLength);
        builder.Property(payment => payment.Notes).IsUnicode().HasMaxLength(OrderRules.PaymentNotesMaxLength);
        builder.Property(payment => payment.CreatedAtUtc).IsRequired();

        builder.HasQueryFilter("SoftDelete", payment => payment.Order.DeletedAtUtc == null);

        // NO ACTION everywhere but the order, so removing a user or a method never rewrites history (SEC-08).
        builder.HasOne<PaymentMethod>().WithMany().HasForeignKey(payment => payment.PaymentMethodId).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(payment => payment.ReceivedByUserId).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(payment => payment.CreatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(payment => payment.UpdatedById).OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(payment => payment.OrderId).HasDatabaseName("IX_OrderPayments_OrderId");
        builder.HasIndex(payment => payment.PaymentMethodId).HasDatabaseName("IX_OrderPayments_PaymentMethodId");
        builder.HasIndex(payment => payment.ReceivedByUserId)
            .IncludeProperties(payment => new { payment.Amount, payment.PaymentDate })
            .HasDatabaseName("IX_OrderPayments_ReceivedByUserId");
        builder.HasIndex(payment => payment.CreatedById).HasDatabaseName("IX_OrderPayments_CreatedById");
        builder.HasIndex(payment => payment.UpdatedById).HasDatabaseName("IX_OrderPayments_UpdatedById");
    }
}
