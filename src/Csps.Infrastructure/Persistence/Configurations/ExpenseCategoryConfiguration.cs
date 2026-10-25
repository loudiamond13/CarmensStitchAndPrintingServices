using Csps.Domain.Expenses;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the expense categories (D-08). The name is unique after normalizing, the tone is one of the six allowed values,
/// and the ten starting rows come from the migration with literal values only (D-09).
/// </summary>
internal sealed class ExpenseCategoryConfiguration : IEntityTypeConfiguration<ExpenseCategory>
{
    public void Configure(EntityTypeBuilder<ExpenseCategory> builder)
    {
        var tones = string.Join(", ", CategoryTones.All.Select(tone => $"N'{tone}'"));
        builder.ToTable("ExpenseCategories", table => table.HasCheckConstraint("CK_ExpenseCategories_Tone", $"[Tone] IN ({tones})"));

        builder.HasKey(category => category.Id);
        builder.Property(category => category.Id).ValueGeneratedNever();

        builder.Property(category => category.Name).IsRequired().IsUnicode().HasMaxLength(ExpenseCategory.NameMaxLength);
        builder.Property(category => category.NormalizedName).IsRequired().IsUnicode().HasMaxLength(ExpenseCategory.NameMaxLength);
        builder.Property(category => category.Tone).IsRequired().IsUnicode().HasMaxLength(ExpenseCategory.ToneMaxLength);
        builder.Property(category => category.CreatedAtUtc).IsRequired();
        builder.Property(category => category.RowVersion).IsRowVersion();

        builder.HasIndex(category => category.NormalizedName).HasDatabaseName("IX_ExpenseCategories_NormalizedName").IsUnique();

        // SEC-08: NO ACTION, so removing a user never rewrites history.
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(category => category.CreatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(category => category.UpdatedById).OnDelete(DeleteBehavior.NoAction);

        // Literal values only: no clock read and no new Guid, or every "migrations add" would see model changes.
        builder.HasData(ExpenseCategorySeed.Rows.Select(row => new
        {
            row.Id,
            row.Name,
            NormalizedName = ExpenseCategory.Normalize(row.Name),
            row.Tone,
            CreatedAtUtc = ExpenseCategorySeed.SeededAtUtc,
        }));
    }
}
