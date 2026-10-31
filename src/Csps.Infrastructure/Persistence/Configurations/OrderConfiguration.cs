using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the Orders table (ORD-03, ORD-14, ORD-20). The number is unique, the status is one of the seven stored numbers, and the
/// stored money figures must agree with each other. A named query filter hides soft-deleted orders from every default query (D-26).
/// </summary>
internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable(
            "Orders",
            table =>
            {
                table.HasCheckConstraint("CK_Orders_Status", "[Status] BETWEEN 1 AND 7");
                table.HasCheckConstraint("CK_Orders_Total", "[Total] = [Subtotal] - [DiscountTotal]");
                table.HasCheckConstraint("CK_Orders_Balance", "[Balance] = [Total] - [PaidTotal] + [RefundedTotal]");
                table.HasCheckConstraint("CK_Orders_CustomerCredit", "[CustomerCredit] = CASE WHEN [Balance] < 0 THEN -[Balance] ELSE 0 END");
            });

        // The domain sets the key (a version 7 id), so EF must treat a new row as Added.
        builder.HasKey(order => order.Id);
        builder.Property(order => order.Id).ValueGeneratedNever();

        builder.Property(order => order.Number).IsRequired().IsUnicode(false).HasMaxLength(OrderNumber.MaxLength);
        builder.Property(order => order.CustomerName).IsRequired().IsUnicode().HasMaxLength(OrderRules.CustomerNameMaxLength);
        builder.Property(order => order.TeamName).IsUnicode().HasMaxLength(OrderRules.TeamNameMaxLength);
        builder.Property(order => order.ContactNumber).IsUnicode().HasMaxLength(OrderRules.ContactNumberMaxLength);
        builder.Property(order => order.Email).IsUnicode().HasMaxLength(OrderRules.EmailMaxLength);
        builder.Property(order => order.Address).IsUnicode().HasMaxLength(OrderRules.AddressMaxLength);
        builder.Property(order => order.OrderDate).HasColumnType("date");
        builder.Property(order => order.DueDate).HasColumnType("date");
        builder.Property(order => order.Notes).IsUnicode().HasMaxLength(OrderRules.NotesMaxLength);
        builder.Property(order => order.Status).HasColumnType("tinyint");

        builder.Property(order => order.Subtotal).HasPrecision(18, 2);
        builder.Property(order => order.DiscountTotal).HasPrecision(18, 2);
        builder.Property(order => order.Total).HasPrecision(18, 2);
        builder.Property(order => order.PaidTotal).HasPrecision(18, 2);
        builder.Property(order => order.RefundedTotal).HasPrecision(18, 2);
        builder.Property(order => order.Balance).HasPrecision(18, 2);
        builder.Property(order => order.CustomerCredit).HasPrecision(18, 2);
        builder.Property(order => order.ExpensesTotal).HasPrecision(18, 2);
        builder.Property(order => order.Profit).HasPrecision(18, 2);
        builder.Property(order => order.CreatedAtUtc).IsRequired();
        builder.Property(order => order.RowVersion).IsRowVersion();
        builder.Ignore(order => order.Totals);
        builder.Ignore(order => order.IsDeleted);

        // D-26: every default query leaves out soft-deleted orders; the Deleted view and restore opt out by name.
        builder.HasQueryFilter("SoftDelete", order => order.DeletedAtUtc == null);

        builder.HasMany(order => order.Items).WithOne(item => item.Order).HasForeignKey(item => item.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(order => order.Discounts).WithOne(discount => discount.Order).HasForeignKey(discount => discount.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(order => order.Payments).WithOne(payment => payment.Order).HasForeignKey(payment => payment.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(order => order.Expenses).WithOne(expense => expense.Order).HasForeignKey(expense => expense.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(order => order.Refunds).WithOne(refund => refund.Order).HasForeignKey(refund => refund.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(order => order.StatusChanges).WithOne(change => change.Order).HasForeignKey(change => change.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(order => order.Items).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Navigation(order => order.Discounts).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Navigation(order => order.Payments).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Navigation(order => order.Expenses).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Navigation(order => order.Refunds).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Navigation(order => order.StatusChanges).UsePropertyAccessMode(PropertyAccessMode.Field);

        // NO ACTION everywhere, so removing a user never rewrites history (SEC-08).
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(order => order.CreatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(order => order.UpdatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(order => order.DeletedById).OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(order => order.Number).IsUnique().HasDatabaseName("IX_Orders_Number");
        builder.HasIndex(order => order.CreatedById).HasDatabaseName("IX_Orders_CreatedById");
        builder.HasIndex(order => order.UpdatedById).HasDatabaseName("IX_Orders_UpdatedById");
        builder.HasIndex(order => order.DeletedById).HasDatabaseName("IX_Orders_DeletedById");

        // The order list (ORD-01, ORD-02, PERF-04). Every index keeps live orders only, because the list never shows a deleted one.
        // The due index is the default sort and covers every column of a list row, so the default page reads from one index.
        builder.HasIndex(order => new { order.DueDate, order.Id })
            .HasFilter("[DeletedAtUtc] IS NULL")
            .IncludeProperties(order => new
            {
                order.Number,
                order.CustomerName,
                order.TeamName,
                order.OrderDate,
                order.Status,
                order.StatusChangedAtUtc,
                order.Subtotal,
                order.DiscountTotal,
                order.Total,
                order.PaidTotal,
                order.RefundedTotal,
                order.Balance,
                order.CustomerCredit,
                order.FullyPaid,
            })
            .HasDatabaseName("IX_Orders_List_Due");

        // The status filter with its recent window, the newest sort and order date range, and the balance and total sorts.
        builder.HasIndex(order => new { order.Status, order.StatusChangedAtUtc }).HasFilter("[DeletedAtUtc] IS NULL").HasDatabaseName("IX_Orders_Status_StatusChangedAtUtc");
        builder.HasIndex(order => new { order.OrderDate, order.CreatedAtUtc, order.Id })
            .IsDescending(true, true, false)
            .HasFilter("[DeletedAtUtc] IS NULL")
            .HasDatabaseName("IX_Orders_OrderDate");
        builder.HasIndex(order => new { order.Balance, order.Id }).IsDescending(true, false).HasFilter("[DeletedAtUtc] IS NULL").HasDatabaseName("IX_Orders_Balance");
        builder.HasIndex(order => new { order.Total, order.Id }).IsDescending(true, false).HasFilter("[DeletedAtUtc] IS NULL").HasDatabaseName("IX_Orders_Total");
    }
}
