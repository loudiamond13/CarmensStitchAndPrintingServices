using Csps.Domain.Expenses;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the company expenses (CEXP-02). The database checks only that the amount is positive (D-33); the 1,000,000.00 cap lives
/// in the validators and the domain. A named query filter hides soft-deleted rows from every default query (D-01), and the
/// index set covers every filter and sort column of the list (PERF-04).
/// </summary>
internal sealed class CompanyExpenseConfiguration : IEntityTypeConfiguration<CompanyExpense>
{
    public void Configure(EntityTypeBuilder<CompanyExpense> builder)
    {
        builder.ToTable("CompanyExpenses", table => table.HasCheckConstraint("CK_CompanyExpenses_Amount_Positive", "[Amount] > 0"));

        // The domain sets the key (a version 7 id), so EF must treat a new row as Added.
        builder.HasKey(expense => expense.Id);
        builder.Property(expense => expense.Id).ValueGeneratedNever();

        builder.Property(expense => expense.ExpenseDate).HasColumnType("date");
        builder.Property(expense => expense.Description).IsRequired().IsUnicode().HasMaxLength(ExpenseRules.DescriptionMaxLength);
        builder.Property(expense => expense.Amount).HasPrecision(18, 2);
        builder.Property(expense => expense.Notes).IsUnicode().HasMaxLength(ExpenseRules.NotesMaxLength);
        builder.Property(expense => expense.CreatedAtUtc).IsRequired();
        builder.Property(expense => expense.RowVersion).IsRowVersion();

        // D-01: every default query leaves out soft-deleted rows; the Deleted view and restore opt out by name.
        builder.HasQueryFilter("SoftDelete", expense => expense.DeletedAtUtc == null);

        // NO ACTION everywhere, so removing a user or a category never rewrites history (SEC-08).
        builder.HasOne<ExpenseCategory>().WithMany().HasForeignKey(expense => expense.CategoryId).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(expense => expense.PaidByUserId).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(expense => expense.CreatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(expense => expense.UpdatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(expense => expense.DeletedById).OnDelete(DeleteBehavior.NoAction);

        // The list: date range, default sort, period total and month sums as an index-only scan.
        builder.HasIndex(expense => new { expense.ExpenseDate, expense.CreatedAtUtc, expense.Id })
            .IsDescending(true, true, true)
            .HasFilter("[DeletedAtUtc] IS NULL")
            .IncludeProperties(expense => new { expense.Amount, expense.CategoryId, expense.PaidByUserId, expense.CreatedById })
            .HasDatabaseName("IX_CompanyExpenses_List");
        builder.HasIndex(expense => new { expense.CategoryId, expense.ExpenseDate }).HasDatabaseName("IX_CompanyExpenses_CategoryId_ExpenseDate");
        builder.HasIndex(expense => expense.PaidByUserId).IncludeProperties(expense => expense.Amount).HasDatabaseName("IX_CompanyExpenses_PaidByUserId");
        builder.HasIndex(expense => expense.CreatedById).HasDatabaseName("IX_CompanyExpenses_CreatedById");
        builder.HasIndex(expense => expense.UpdatedById).HasDatabaseName("IX_CompanyExpenses_UpdatedById");
        builder.HasIndex(expense => expense.DeletedById).HasDatabaseName("IX_CompanyExpenses_DeletedById");

        // The Deleted view sorts by the delete time.
        builder.HasIndex(expense => expense.DeletedAtUtc)
            .IsDescending()
            .HasFilter("[DeletedAtUtc] IS NOT NULL")
            .HasDatabaseName("IX_CompanyExpenses_Deleted");
    }
}
