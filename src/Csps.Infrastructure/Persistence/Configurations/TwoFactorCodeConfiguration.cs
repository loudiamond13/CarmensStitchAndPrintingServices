using Csps.Domain.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>Maps emailed codes (AUTH-03). Only the HMAC-SHA256 of a code is stored, never the code.</summary>
internal sealed class TwoFactorCodeConfiguration : IEntityTypeConfiguration<TwoFactorCode>
{
    public void Configure(EntityTypeBuilder<TwoFactorCode> builder)
    {
        builder.ToTable("TwoFactorCodes");

        builder.HasKey(code => code.Id);
        builder.Property(code => code.Id).ValueGeneratedNever();

        builder.Property(code => code.CodeMac).IsRequired().HasColumnType("binary(32)");

        builder.HasIndex(code => code.ChallengeId).HasDatabaseName("IX_TwoFactorCodes_ChallengeId");
    }
}
