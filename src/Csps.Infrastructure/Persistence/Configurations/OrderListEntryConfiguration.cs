using Csps.Domain.Expenses;
using Csps.Domain.OrderLists;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps one Manager-editable order list (D-19). Each list is its own table with no discriminator. The name is unique after
/// normalizing, the tone is one of the six allowed values, and the starting rows come from the migration with literal values only.
/// </summary>
/// <typeparam name="TEntry">The list entry type.</typeparam>
/// <param name="table">The table name.</param>
/// <param name="seed">The starting rows.</param>
internal abstract class OrderListEntryConfiguration<TEntry>(string table, IReadOnlyList<OrderListSeedRow> seed) : IEntityTypeConfiguration<TEntry>
    where TEntry : OrderListEntry
{
    public void Configure(EntityTypeBuilder<TEntry> builder)
    {
        var tones = string.Join(", ", CategoryTones.All.Select(tone => $"N'{tone}'"));
        builder.ToTable(table, check => check.HasCheckConstraint($"CK_{table}_Tone", $"[Tone] IN ({tones})"));

        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.Id).ValueGeneratedNever();

        builder.Property(entry => entry.Name).IsRequired().IsUnicode().HasMaxLength(OrderListEntry.NameMaxLength);
        builder.Property(entry => entry.NormalizedName).IsRequired().IsUnicode().HasMaxLength(OrderListEntry.NameMaxLength);
        builder.Property(entry => entry.Tone).IsRequired().IsUnicode().HasMaxLength(OrderListEntry.ToneMaxLength);
        builder.Property(entry => entry.CreatedAtUtc).IsRequired();
        builder.Property(entry => entry.RowVersion).IsRowVersion();

        builder.HasIndex(entry => entry.NormalizedName).HasDatabaseName($"IX_{table}_NormalizedName").IsUnique();

        // SEC-08: NO ACTION, so removing a user never rewrites history.
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(entry => entry.CreatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(entry => entry.UpdatedById).OnDelete(DeleteBehavior.NoAction);

        // Literal values only: no clock read and no new Guid, or every "migrations add" would see model changes.
        builder.HasData(seed.Select(row => new
        {
            row.Id,
            row.Name,
            NormalizedName = OrderListEntry.Normalize(row.Name),
            row.Tone,
            CreatedAtUtc = OrderListSeed.SeededAtUtc,
        }));
    }
}
