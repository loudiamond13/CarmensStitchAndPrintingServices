using System.Globalization;
using Csps.Domain.Content;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the public product lines (D-01, CONT-02). The rules that fit one row live in CHECK constraints, not triggers (OR-7): a price is
/// above zero and at most 999,999.99, and a minimum order is 1 to 9,999. The key and the short name are unique (the default collation
/// ignores case). The six starting rows come from one hand-written <c>InsertData</c> in the AddProductLines migration, never from the
/// model, so a later deploy can never overwrite a Manager's edits (D-06). The drawing is stored by name.
/// </summary>
internal sealed class ProductLineConfiguration : IEntityTypeConfiguration<ProductLine>
{
    public void Configure(EntityTypeBuilder<ProductLine> builder)
    {
        builder.ToTable("ProductLines", table =>
        {
            table.HasCheckConstraint(
                "CK_ProductLines_Price",
                string.Create(
                    CultureInfo.InvariantCulture,
                    $"[StartsAtPrice] > 0 AND [StartsAtPrice] <= {ProductLine.MaxPrice}"));
            table.HasCheckConstraint(
                "CK_ProductLines_Minimum",
                string.Create(
                    CultureInfo.InvariantCulture,
                    $"[MinimumQuantity] BETWEEN {ProductLine.MinQuantity} AND {ProductLine.MaxQuantity}"));
        });

        builder.HasKey(line => line.Id);
        builder.Property(line => line.Id).ValueGeneratedNever();

        builder.Property(line => line.Key).IsRequired().IsUnicode().HasMaxLength(ProductLine.KeyMaxLength);
        builder.Property(line => line.Title).IsRequired().IsUnicode().HasMaxLength(ProductLine.TitleMaxLength);
        builder.Property(line => line.ShortName).IsRequired().IsUnicode().HasMaxLength(ProductLine.ShortNameMaxLength);
        builder.Property(line => line.Number).IsRequired().IsUnicode().HasMaxLength(ProductLine.NumberMaxLength);
        builder.Property(line => line.CardText).IsRequired().IsUnicode().HasMaxLength(ProductLine.CardTextMaxLength);
        builder.Property(line => line.Description).IsRequired().IsUnicode().HasMaxLength(ProductLine.DescriptionMaxLength);
        builder.Property(line => line.FabricText).IsRequired().IsUnicode().HasMaxLength(ProductLine.CustomizeTextMaxLength);
        builder.Property(line => line.CollarText).IsRequired().IsUnicode().HasMaxLength(ProductLine.CustomizeTextMaxLength);
        builder.Property(line => line.CutText).IsRequired().IsUnicode().HasMaxLength(ProductLine.CustomizeTextMaxLength);
        builder.Property(line => line.NamesText).IsRequired().IsUnicode().HasMaxLength(ProductLine.CustomizeTextMaxLength);
        builder.Property(line => line.LogosText).IsRequired().IsUnicode().HasMaxLength(ProductLine.CustomizeTextMaxLength);
        builder.Property(line => line.StartsAtPrice).HasPrecision(18, 2);
        builder.Property(line => line.PlaceholderArt).HasConversion<string>().IsRequired().IsUnicode(false).HasMaxLength(20);
        builder.Property(line => line.CreatedAtUtc).IsRequired();
        builder.Property(line => line.RowVersion).IsRowVersion();

        builder.HasIndex(line => line.Key).IsUnique().HasDatabaseName("UX_ProductLines_Key");
        builder.HasIndex(line => line.ShortName).IsUnique().HasDatabaseName("UX_ProductLines_ShortName");

        // The public read lists the shown lines in order.
        builder.HasIndex(line => new { line.Position, line.Id }).HasDatabaseName("IX_ProductLines_Position");
    }
}
