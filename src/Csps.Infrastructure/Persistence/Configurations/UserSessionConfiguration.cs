using Csps.Domain.Identity;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>Maps sign-in sessions (AUTH-05, D-43). The row version makes two writers of one session a concurrency conflict.</summary>
internal sealed class UserSessionConfiguration : IEntityTypeConfiguration<UserSession>
{
    public void Configure(EntityTypeBuilder<UserSession> builder)
    {
        builder.ToTable("UserSessions");

        // The domain sets the key (a version 7 id), so EF must treat a new row as Added.
        builder.HasKey(session => session.Id);
        builder.Property(session => session.Id).ValueGeneratedNever();

        builder.Property(session => session.DeviceLabel).IsRequired().HasMaxLength(UserSession.DeviceLabelMaxLength);
        builder.Property(session => session.RevokedReason).HasConversion<byte?>();
        builder.Property(session => session.RowVersion).IsRowVersion();

        builder.HasOne<ApplicationUser>()
            .WithMany()
            .HasForeignKey(session => session.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(session => new { session.UserId, session.RevokedAt }).HasDatabaseName("IX_UserSessions_UserId_RevokedAt");
    }
}
