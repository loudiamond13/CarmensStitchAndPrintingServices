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

        // Same name as Identity's own index, so the default non-unique one is replaced, not duplicated.
        builder.HasIndex(user => user.NormalizedEmail)
            .HasDatabaseName("EmailIndex")
            .IsUnique()
            .HasFilter("[NormalizedEmail] IS NOT NULL");
    }
}
