using Csps.Domain.QuoteRequests;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the QuoteRequestPhotos table (INQ-02). A row is one declared photo place of a request: the key is the request and the slot
/// (0 to 4, held by a check constraint), and a place with no public id is a missing photo (D-03). The rows leave with their request.
/// A stored public id is unique, so two places never name one file. A visitor has no account, so there are no staff links (SEC-08). No
/// JSON column and no trigger (OR-7).
/// </summary>
internal sealed class QuoteRequestPhotoConfiguration : IEntityTypeConfiguration<QuoteRequestPhoto>
{
    public void Configure(EntityTypeBuilder<QuoteRequestPhoto> builder)
    {
        builder.ToTable(
            "QuoteRequestPhotos",
            table => table.HasCheckConstraint("CK_QuoteRequestPhotos_Slot", "[Slot] BETWEEN 0 AND 4"));

        builder.HasKey(photo => new { photo.QuoteRequestId, photo.Slot });
        builder.Property(photo => photo.Slot).HasConversion<byte>();
        builder.Property(photo => photo.FileName).IsRequired().IsUnicode().HasMaxLength(QuoteRequestRules.PhotoNameMaxLength);
        builder.Property(photo => photo.PublicId).IsUnicode().HasMaxLength(200);
        builder.Property(photo => photo.Kind).IsUnicode(false).HasMaxLength(8);

        builder.HasIndex(photo => photo.PublicId)
            .IsUnique()
            .HasFilter("[PublicId] IS NOT NULL")
            .HasDatabaseName("IX_QuoteRequestPhotos_PublicId");
    }
}
