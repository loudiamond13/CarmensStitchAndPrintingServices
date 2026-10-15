using Csps.Domain.Identity;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps account link tokens (AUTH-08, D-28). Only the SHA-256 of the token is stored, and it is unique. The purpose is
/// a small number, so Phase 5 adds email-change links without a schema change.
/// </summary>
internal sealed class AccountTokenConfiguration : IEntityTypeConfiguration<AccountToken>
{
    public void Configure(EntityTypeBuilder<AccountToken> builder)
    {
        builder.ToTable("AccountTokens");

        builder.HasKey(token => token.Id);
        builder.Property(token => token.Id).ValueGeneratedNever();

        builder.Property(token => token.Purpose).HasConversion<byte>();
        builder.Property(token => token.TokenHash).IsRequired().HasColumnType("binary(32)");
        builder.Property(token => token.RowVersion).IsRowVersion();

        builder.HasOne<ApplicationUser>()
            .WithMany()
            .HasForeignKey(token => token.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(token => token.TokenHash).IsUnique().HasDatabaseName("UX_AccountTokens_TokenHash");
        builder.HasIndex(token => new { token.UserId, token.Purpose, token.CreatedAt }).HasDatabaseName("IX_AccountTokens_UserId_Purpose_CreatedAt");
    }
}
