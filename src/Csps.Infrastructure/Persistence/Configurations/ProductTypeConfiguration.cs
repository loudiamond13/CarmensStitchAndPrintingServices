using Csps.Domain.OrderLists;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>Maps the product types (D-18) to the <c>ProductTypes</c> table.</summary>
internal sealed class ProductTypeConfiguration() : OrderListEntryConfiguration<ProductType>("ProductTypes", OrderListSeed.ProductTypes);
