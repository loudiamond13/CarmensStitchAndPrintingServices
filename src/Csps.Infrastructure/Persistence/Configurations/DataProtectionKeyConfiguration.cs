using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the Data Protection key ring (SEC-04, D-15). Each row is one key as XML text, encrypted with the configured
/// certificate before it is stored. <c>Xml</c> stays <c>nvarchar(max)</c> text (no JSON column, D-13). The framework
/// owns this shape, so there is no rowversion: keys are only added, never edited.
/// </summary>
internal sealed class DataProtectionKeyConfiguration : IEntityTypeConfiguration<DataProtectionKey>
{
    public void Configure(EntityTypeBuilder<DataProtectionKey> builder)
    {
        builder.ToTable("DataProtectionKeys");

        builder.HasKey(key => key.Id);
        builder.Property(key => key.Id).UseIdentityColumn();

        builder.Property(key => key.FriendlyName).IsUnicode();
        builder.Property(key => key.Xml).IsUnicode();
    }
}
