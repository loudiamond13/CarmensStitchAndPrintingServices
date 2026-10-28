using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>Maps the OrderStatusChanges table (ORD-16, D-06): the status history, which leaves and hides with its order.</summary>
internal sealed class OrderStatusChangeConfiguration : IEntityTypeConfiguration<OrderStatusChange>
{
    public void Configure(EntityTypeBuilder<OrderStatusChange> builder)
    {
        builder.ToTable("OrderStatusChanges");

        builder.HasKey(change => change.Id);
        builder.Property(change => change.Id).ValueGeneratedNever();

        builder.Property(change => change.FromStatus).HasColumnType("tinyint");
        builder.Property(change => change.ToStatus).HasColumnType("tinyint");
        builder.Property(change => change.ChangedAtUtc).IsRequired();

        builder.HasQueryFilter("SoftDelete", change => change.Order.DeletedAtUtc == null);

        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(change => change.ChangedById).OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(change => change.OrderId).HasDatabaseName("IX_OrderStatusChanges_OrderId");
        builder.HasIndex(change => change.ChangedById).HasDatabaseName("IX_OrderStatusChanges_ChangedById");
    }
}
