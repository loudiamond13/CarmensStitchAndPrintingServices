using Csps.Domain.Orders;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>Maps the OrderNumberCounters table (ORD-14, D-23): the last number given out in each business year.</summary>
internal sealed class OrderNumberCounterConfiguration : IEntityTypeConfiguration<OrderNumberCounter>
{
    public void Configure(EntityTypeBuilder<OrderNumberCounter> builder)
    {
        builder.ToTable("OrderNumberCounters", table => table.HasCheckConstraint("CK_OrderNumberCounters_LastValue", "[LastValue] >= 0"));

        builder.HasKey(counter => counter.Year);
        builder.Property(counter => counter.Year).ValueGeneratedNever();
    }
}
