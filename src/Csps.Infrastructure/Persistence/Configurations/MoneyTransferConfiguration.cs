using Csps.Domain.Money;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the money transfers (MONEY-04, D-23). Two checks keep a row sane without a trigger: the amount is positive and the sender is not
/// the recipient. There is deliberately no query filter: a filter named <c>SoftDelete</c> would be lifted together with the order
/// filters by any query that shows deleted transfers, so every reader leaves deleted transfers out by an explicit
/// <c>DeletedAtUtc</c> check in one place.
/// </summary>
internal sealed class MoneyTransferConfiguration : IEntityTypeConfiguration<MoneyTransfer>
{
    public void Configure(EntityTypeBuilder<MoneyTransfer> builder)
    {
        builder.ToTable("MoneyTransfers", table =>
        {
            table.HasCheckConstraint("CK_MoneyTransfers_Amount_Positive", "[Amount] > 0");
            table.HasCheckConstraint("CK_MoneyTransfers_FromTo_Different", "[FromUserId] <> [ToUserId]");
        });

        // The domain sets the key (a version 7 id), so EF must treat a new row as Added.
        builder.HasKey(transfer => transfer.Id);
        builder.Property(transfer => transfer.Id).ValueGeneratedNever();

        builder.Property(transfer => transfer.Amount).HasPrecision(18, 2);
        builder.Property(transfer => transfer.TransferDate).HasColumnType("date");
        builder.Property(transfer => transfer.Note).IsUnicode().HasMaxLength(MoneyRules.NoteMaxLength);
        builder.Property(transfer => transfer.IsHandover).IsRequired().HasDefaultValue(false);
        builder.Property(transfer => transfer.CreatedAtUtc).IsRequired();
        builder.Property(transfer => transfer.RowVersion).IsRowVersion();

        // NO ACTION everywhere, so removing a user never rewrites history (SEC-08).
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(transfer => transfer.FromUserId).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(transfer => transfer.ToUserId).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(transfer => transfer.CreatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(transfer => transfer.UpdatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(transfer => transfer.DeletedById).OnDelete(DeleteBehavior.NoAction);

        // Money out and money in per person: an index-only scan for the balance sums and the ledger.
        builder.HasIndex(transfer => transfer.FromUserId)
            .IncludeProperties(transfer => new { transfer.Amount, transfer.TransferDate, transfer.CreatedAtUtc, transfer.DeletedAtUtc })
            .HasDatabaseName("IX_MoneyTransfers_FromUserId");
        builder.HasIndex(transfer => transfer.ToUserId)
            .IncludeProperties(transfer => new { transfer.Amount, transfer.TransferDate, transfer.CreatedAtUtc, transfer.DeletedAtUtc })
            .HasDatabaseName("IX_MoneyTransfers_ToUserId");

        // The Transfers tab: newest first.
        builder.HasIndex(transfer => new { transfer.TransferDate, transfer.CreatedAtUtc, transfer.Id })
            .IsDescending(true, true, false)
            .HasDatabaseName("IX_MoneyTransfers_List");

        builder.HasIndex(transfer => transfer.CreatedById).HasDatabaseName("IX_MoneyTransfers_CreatedById");
        builder.HasIndex(transfer => transfer.UpdatedById).HasDatabaseName("IX_MoneyTransfers_UpdatedById");
        builder.HasIndex(transfer => transfer.DeletedById).HasDatabaseName("IX_MoneyTransfers_DeletedById");
    }
}
