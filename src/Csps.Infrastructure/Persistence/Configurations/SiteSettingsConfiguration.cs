using Csps.Domain.Content;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the SiteSettings singleton (FND-09). One row only, enforced by <c>CK_SiteSettings_Singleton</c>.
/// Strings are <c>nvarchar</c> with explicit lengths (UTF-16 code units), so the peso sign and other
/// non-ASCII text round-trip. The seed row comes from the migration with literal values only.
/// </summary>
internal sealed class SiteSettingsConfiguration : IEntityTypeConfiguration<SiteSettings>
{
    public void Configure(EntityTypeBuilder<SiteSettings> builder)
    {
        builder.ToTable("SiteSettings", table =>
            table.HasCheckConstraint("CK_SiteSettings_Singleton", $"[Id] = {SiteSettings.SingletonId}"));

        builder.HasKey(settings => settings.Id);
        builder.Property(settings => settings.Id).ValueGeneratedNever();

        builder.Property(settings => settings.BusinessName).IsRequired().IsUnicode().HasMaxLength(SiteSettings.BusinessNameMaxLength);
        builder.Property(settings => settings.TimeZoneId).IsRequired().IsUnicode().HasMaxLength(SiteSettings.TimeZoneIdMaxLength);
        builder.Property(settings => settings.CurrencyCode).IsRequired().IsUnicode().HasMaxLength(SiteSettings.CurrencyCodeMaxLength);
        builder.Property(settings => settings.Locale).IsRequired().IsUnicode().HasMaxLength(SiteSettings.LocaleMaxLength);
        builder.Property(settings => settings.ContactEmail).IsRequired().IsUnicode().HasMaxLength(SiteSettings.ContactEmailMaxLength);
        builder.Property(settings => settings.ContactPhone).IsRequired().IsUnicode().HasMaxLength(SiteSettings.ContactPhoneMaxLength);
        builder.Property(settings => settings.AddressLine).IsRequired().IsUnicode().HasMaxLength(SiteSettings.AddressLineMaxLength);
        builder.Property(settings => settings.FacebookUrl).IsRequired().IsUnicode().HasMaxLength(SiteSettings.FacebookUrlMaxLength);

        builder.Property(settings => settings.CreatedAtUtc).IsRequired();
        builder.Property(settings => settings.RowVersion).IsRowVersion();

        // Literal values only: no clock read and no new Guid, or every "migrations add" would see model changes.
        builder.HasData(new
        {
            Id = SiteSettings.SingletonId,
            SiteSettingsDefaults.BusinessName,
            SiteSettingsDefaults.TimeZoneId,
            SiteSettingsDefaults.CurrencyCode,
            SiteSettingsDefaults.Locale,
            SiteSettingsDefaults.ContactEmail,
            SiteSettingsDefaults.ContactPhone,
            SiteSettingsDefaults.AddressLine,
            SiteSettingsDefaults.FacebookUrl,
            CreatedAtUtc = SiteSettingsDefaults.SeededAtUtc,
        });
    }
}
