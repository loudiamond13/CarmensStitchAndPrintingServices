using Csps.Domain.Identity;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps pending sign-ins (AUTH-02, AUTH-03). Only the SHA-256 of the ticket is stored. The row version makes a second
/// verification of the same challenge a concurrency conflict.
/// </summary>
internal sealed class TwoFactorChallengeConfiguration : IEntityTypeConfiguration<TwoFactorChallenge>
{
    public void Configure(EntityTypeBuilder<TwoFactorChallenge> builder)
    {
        builder.ToTable("TwoFactorChallenges");

        // The domain sets the key (a version 7 id), so EF must treat a new child as Added, not as an existing row.
        builder.HasKey(challenge => challenge.Id);
        builder.Property(challenge => challenge.Id).ValueGeneratedNever();

        builder.Property(challenge => challenge.TicketHash).IsRequired().HasColumnType("binary(32)");
        builder.Property(challenge => challenge.Status).HasConversion<byte>();
        builder.Property(challenge => challenge.PasswordChangeReason).HasConversion<byte?>();
        builder.Property(challenge => challenge.RowVersion).IsRowVersion();

        builder.HasOne<ApplicationUser>()
            .WithMany()
            .HasForeignKey(challenge => challenge.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(challenge => challenge.Codes)
            .WithOne()
            .HasForeignKey(code => code.ChallengeId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(challenge => challenge.Codes).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(challenge => challenge.TicketHash).IsUnique().HasDatabaseName("UX_TwoFactorChallenges_TicketHash");
        builder.HasIndex(challenge => new { challenge.UserId, challenge.CreatedAt }).HasDatabaseName("IX_TwoFactorChallenges_UserId_CreatedAt");
    }
}
