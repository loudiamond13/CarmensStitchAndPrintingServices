using Csps.Domain.Content;
using Csps.Domain.OrderLists;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the product types (D-18) to the <c>ProductTypes</c> table, with the optional link to the public product line they are filed
/// under (D-09). The link cannot leave a dangling id: a line that has product types cannot be deleted.
/// </summary>
internal sealed class ProductTypeConfiguration() : OrderListEntryConfiguration<ProductType>("ProductTypes", OrderListSeed.ProductTypes)
{
    public override void Configure(EntityTypeBuilder<ProductType> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        base.Configure(builder);

        builder.HasOne<ProductLine>().WithMany().HasForeignKey(type => type.ProductLineId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(type => type.ProductLineId).HasDatabaseName("IX_ProductTypes_ProductLineId");
    }
}
