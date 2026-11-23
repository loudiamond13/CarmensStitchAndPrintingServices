using Csps.Domain.Orders;
using Csps.Domain.QuoteRequests;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the QuoteRequestStatusChanges table (D-15): the status history, which leaves with its request. The two statuses are bytes held
/// to the known range, as on QuoteRequests. The staff and order links never cascade, so removing a user or an order never rewrites
/// history (SEC-08). No trigger (OR-7).
/// </summary>
internal sealed class QuoteRequestStatusChangeConfiguration : IEntityTypeConfiguration<QuoteRequestStatusChange>
{
    public void Configure(EntityTypeBuilder<QuoteRequestStatusChange> builder)
    {
        builder.ToTable(
            "QuoteRequestStatusChanges",
            table =>
            {
                table.HasCheckConstraint("CK_QuoteRequestStatusChanges_FromStatus", "[FromStatus] BETWEEN 1 AND 6");
                table.HasCheckConstraint("CK_QuoteRequestStatusChanges_ToStatus", "[ToStatus] BETWEEN 1 AND 6");
            });

        builder.HasKey(change => change.Id);
        builder.Property(change => change.Id).ValueGeneratedNever();

        builder.Property(change => change.FromStatus).HasConversion<byte>();
        builder.Property(change => change.ToStatus).HasConversion<byte>();
        builder.Property(change => change.ChangedAtUtc).IsRequired();

        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(change => change.ChangedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<Order>().WithMany().HasForeignKey(change => change.OrderId).OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(change => new { change.QuoteRequestId, change.ChangedAtUtc }).HasDatabaseName("IX_QuoteRequestStatusChanges_QuoteRequestId_ChangedAtUtc");
        builder.HasIndex(change => change.ChangedById).HasDatabaseName("IX_QuoteRequestStatusChanges_ChangedById");
        builder.HasIndex(change => change.OrderId).HasDatabaseName("IX_QuoteRequestStatusChanges_OrderId");
    }
}
