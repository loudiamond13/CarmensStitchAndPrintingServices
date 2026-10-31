using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Adds the CSPS columns to the Identity user table and makes the normalized-email index unique, so two
/// concurrent creates cannot both pass the <c>RequireUniqueEmail</c> check (T-04-24).
/// </summary>
internal sealed class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        builder.Property(user => user.FirstName).IsRequired().IsUnicode().HasMaxLength(ApplicationUser.NameMaxLength);
        builder.Property(user => user.LastName).IsRequired().IsUnicode().HasMaxLength(ApplicationUser.NameMaxLength);
        builder.Property(user => user.IsActive).HasDefaultValue(true);
        builder.Property(user => user.MustChangePassword).HasDefaultValue(false);
        builder.Property(user => user.BreachRecheckPending).HasDefaultValue(false);
        builder.Property(user => user.MustChangePasswordReason).HasConversion<byte?>();

        // SEC-07: a Guid the application replaces on every change, checked on save; the default covers raw inserts.
        builder.Property(user => user.EditVersion).IsConcurrencyToken().HasDefaultValueSql("NEWID()");
        builder.Property(user => user.PendingEmail).HasMaxLength(256);

        // SEC-08: attribution points at the user row itself; NO ACTION so removing a user never rewrites history.
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(user => user.CreatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(user => user.UpdatedById).OnDelete(DeleteBehavior.NoAction);
        builder.HasIndex(user => user.CreatedById);
        builder.HasIndex(user => user.UpdatedById);

        // Same name as Identity's own index, so the default non-unique one is replaced, not duplicated.
        builder.HasIndex(user => user.NormalizedEmail)
            .HasDatabaseName("EmailIndex")
            .IsUnique()
            .HasFilter("[NormalizedEmail] IS NOT NULL");

        builder.HasData(ApplicationUser.ForLegacyHolder());
    }
}
