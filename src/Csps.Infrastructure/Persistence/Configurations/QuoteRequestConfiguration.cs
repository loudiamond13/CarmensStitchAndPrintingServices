using Csps.Domain.Content;
using Csps.Domain.QuoteRequests;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the QuoteRequests table (INQ-01). The three stored numbers (status, product choice, quantity range) are bytes that are
/// never renumbered, each held to its known range by a check constraint. The product line is a nullable link that clears when the
/// line is deleted, because the title is kept as a snapshot (D-24). No JSON column and no trigger (OR-7). The indexes serve the inbox
/// list by status and date, the per-sender limits by number and by email, and the retention cleanup by date.
/// </summary>
internal sealed class QuoteRequestConfiguration : IEntityTypeConfiguration<QuoteRequest>
{
    public void Configure(EntityTypeBuilder<QuoteRequest> builder)
    {
        builder.ToTable(
            "QuoteRequests",
            table =>
            {
                table.HasCheckConstraint("CK_QuoteRequests_Status", "[Status] BETWEEN 1 AND 6");
                table.HasCheckConstraint("CK_QuoteRequests_ProductChoice", "[ProductChoice] IS NULL OR [ProductChoice] BETWEEN 1 AND 3");
                table.HasCheckConstraint("CK_QuoteRequests_QuantityRange", "[QuantityRange] IS NULL OR [QuantityRange] BETWEEN 1 AND 5");
            });

        // The domain sets the key (a version 7 id), so EF must treat a new row as Added.
        builder.HasKey(request => request.Id);
        builder.Property(request => request.Id).ValueGeneratedNever();

        builder.Property(request => request.CustomerName).IsRequired().IsUnicode().HasMaxLength(QuoteRequestRules.CustomerNameMaxLength);
        builder.Property(request => request.TeamName).IsUnicode().HasMaxLength(QuoteRequestRules.TeamNameMaxLength);
        builder.Property(request => request.ContactNumberE164).IsRequired().IsUnicode(false).HasMaxLength(QuoteRequestRules.ContactNumberE164MaxLength);
        builder.Property(request => request.Email).IsUnicode().HasMaxLength(QuoteRequestRules.EmailMaxLength);
        builder.Property(request => request.ProductChoice).HasConversion<byte>();
        builder.Property(request => request.ProductTitle).IsUnicode().HasMaxLength(QuoteRequestRules.ProductTitleMaxLength);
        builder.Property(request => request.QuantityRange).HasConversion<byte>();
        builder.Property(request => request.Message).IsUnicode().HasMaxLength(QuoteRequestRules.MessageMaxLength);
        builder.Property(request => request.Status).HasConversion<byte>();
        builder.Property(request => request.StatusChangedAtUtc).IsRequired();
        builder.Property(request => request.CreatedAtUtc).IsRequired();
        builder.Property(request => request.RowVersion).IsRowVersion();

        // Only the SHA-256 of the visitor's upload key is stored, never the key (CWE-639).
        builder.Property(request => request.UploadKeyHash).HasColumnType("varbinary(32)");

        // The photo places leave with their request.
        builder.HasMany(request => request.Photos).WithOne().HasForeignKey(photo => photo.QuoteRequestId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(request => request.Photos).UsePropertyAccessMode(PropertyAccessMode.Field);

        // The status history leaves with its request, including through the 6-month purge.
        builder.HasMany(request => request.StatusChanges).WithOne().HasForeignKey(change => change.QuoteRequestId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(request => request.StatusChanges).UsePropertyAccessMode(PropertyAccessMode.Field);

        // NO ACTION on the staff links, so removing a user never rewrites history (SEC-08). A visitor has no user, so CreatedById stays null.
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(request => request.CreatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(request => request.UpdatedById).OnDelete(DeleteBehavior.NoAction);

        // Deleting a product line keeps the request and its title snapshot.
        builder.HasOne<ProductLine>().WithMany().HasForeignKey(request => request.ProductLineId).OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(request => new { request.Status, request.CreatedAtUtc, request.Id })
            .IsDescending(false, true, true)
            .HasDatabaseName("IX_QuoteRequests_Status_CreatedAtUtc");
        builder.HasIndex(request => new { request.ContactNumberE164, request.CreatedAtUtc }).HasDatabaseName("IX_QuoteRequests_ContactNumberE164_CreatedAtUtc");
        builder.HasIndex(request => new { request.Email, request.CreatedAtUtc }).HasDatabaseName("IX_QuoteRequests_Email_CreatedAtUtc");
        builder.HasIndex(request => request.CreatedAtUtc).HasDatabaseName("IX_QuoteRequests_CreatedAtUtc");
        builder.HasIndex(request => request.CreatedById).HasDatabaseName("IX_QuoteRequests_CreatedById");
        builder.HasIndex(request => request.UpdatedById).HasDatabaseName("IX_QuoteRequests_UpdatedById");
        builder.HasIndex(request => request.ProductLineId).HasDatabaseName("IX_QuoteRequests_ProductLineId");
    }
}
