using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the OrderExpenses table (ORD-05, ORD-23). An expense leaves with its order, and it hides with the order through a matching
/// named query filter, so EF has no required-navigation-to-a-filtered-entity warning. The database checks only that the amount is
/// positive; the 1,000,000.00 cap and the date window live in the domain. The payer index carries the amount and the date, so
/// Phase 10's money on hand reads the index alone.
/// </summary>
internal sealed class OrderExpenseConfiguration : IEntityTypeConfiguration<OrderExpense>
{
    public void Configure(EntityTypeBuilder<OrderExpense> builder)
    {
        builder.ToTable("OrderExpenses", table => table.HasCheckConstraint("CK_OrderExpenses_Amount_Positive", "[Amount] > 0"));

        builder.HasKey(expense => expense.Id);
        builder.Property(expense => expense.Id).ValueGeneratedNever();

        builder.Property(expense => expense.ExpenseDate).HasColumnType("date");
        builder.Property(expense => expense.Amount).HasPrecision(18, 2);
        builder.Property(expense => expense.Description).IsUnicode().HasMaxLength(OrderRules.ExpenseDescriptionMaxLength);
        builder.Property(expense => expense.CreatedAtUtc).IsRequired();

        builder.HasQueryFilter("SoftDelete", expense => expense.Order.DeletedAtUtc == null);

        // NO ACTION everywhere but the order, so removing a user or a category never rewrites history (SEC-08).
        builder.HasOne<OrderExpenseCategory>().WithMany().HasForeignKey(expense => expense.OrderExpenseCategoryId).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(expense => expense.PaidByUserId).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(expense => expense.CreatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(expense => expense.UpdatedById).OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(expense => expense.OrderId).HasDatabaseName("IX_OrderExpenses_OrderId");
        builder.HasIndex(expense => expense.OrderExpenseCategoryId).HasDatabaseName("IX_OrderExpenses_OrderExpenseCategoryId");
        builder.HasIndex(expense => expense.PaidByUserId)
            .IncludeProperties(expense => new { expense.Amount, expense.ExpenseDate })
            .HasDatabaseName("IX_OrderExpenses_PaidByUserId");
        builder.HasIndex(expense => expense.CreatedById).HasDatabaseName("IX_OrderExpenses_CreatedById");
        builder.HasIndex(expense => expense.UpdatedById).HasDatabaseName("IX_OrderExpenses_UpdatedById");
    }
}
