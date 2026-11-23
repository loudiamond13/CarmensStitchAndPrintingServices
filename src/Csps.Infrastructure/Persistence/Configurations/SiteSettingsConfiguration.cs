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
        builder.Ignore(settings => settings.QuoteAlertsEmail);
        builder.Property(settings => settings.ContactPhone).IsRequired().IsUnicode().HasMaxLength(SiteSettings.ContactPhoneMaxLength);
        builder.Property(settings => settings.AddressLine).IsRequired().IsUnicode().HasMaxLength(SiteSettings.AddressLineMaxLength);
        builder.Property(settings => settings.FacebookUrl).IsRequired().IsUnicode().HasMaxLength(SiteSettings.FacebookUrlMaxLength);

        // The public business facts (CONT-01). Optional values are null until the Manager sets them.
        builder.Property(settings => settings.Tagline).IsRequired().IsUnicode().HasMaxLength(SiteSettings.TaglineMaxLength);
        builder.Property(settings => settings.AboutText).IsUnicode().HasMaxLength(SiteSettings.AboutTextMaxLength);
        builder.Property(settings => settings.TurnaroundLine).IsUnicode().HasMaxLength(SiteSettings.TurnaroundLineMaxLength);
        builder.Property(settings => settings.Street).IsUnicode().HasMaxLength(SiteSettings.StreetMaxLength);
        builder.Property(settings => settings.TownOrCity).IsUnicode().HasMaxLength(SiteSettings.TownOrCityMaxLength);
        builder.Property(settings => settings.Province).IsUnicode().HasMaxLength(SiteSettings.ProvinceMaxLength);
        builder.Property(settings => settings.PostalCode).IsUnicode().HasMaxLength(SiteSettings.PostalCodeMaxLength);
        builder.Property(settings => settings.DirectionsUrl).IsUnicode().HasMaxLength(SiteSettings.DirectionsUrlMaxLength);
        builder.Property(settings => settings.MapEmbedUrl).IsUnicode().HasMaxLength(SiteSettings.MapEmbedUrlMaxLength);
        builder.Property(settings => settings.MessengerUrl).IsUnicode().HasMaxLength(SiteSettings.MessengerUrlMaxLength);
        builder.Property(settings => settings.InstagramUrl).IsUnicode().HasMaxLength(SiteSettings.InstagramUrlMaxLength);
        builder.Property(settings => settings.TikTokUrl).IsUnicode().HasMaxLength(SiteSettings.TikTokUrlMaxLength);

        // The default link preview picture (D-26). All five are null until a Manager uploads one.
        builder.Property(settings => settings.SharePicturePublicId).IsUnicode().HasMaxLength(200);
        builder.Property(settings => settings.SharePictureWidth);
        builder.Property(settings => settings.SharePictureHeight);
        builder.Property(settings => settings.SharePictureBytes);
        builder.Property(settings => settings.SharePictureFormat).IsUnicode(false).HasMaxLength(8);

        builder.Property(settings => settings.CreatedAtUtc).IsRequired();

        // SEC-08: the attribution members use the column names the table already had, so nothing is renamed (D-39).
        builder.Property(settings => settings.CreatedById).HasColumnName("CreatedByUserId");
        builder.Property(settings => settings.UpdatedById).HasColumnName("UpdatedByUserId");
        builder.Property(settings => settings.RowVersion).IsRowVersion();

        // Literal values only: no clock read and no new Guid, or every "migrations add" would see model changes.
        builder.HasData(new
        {
            Id = SiteSettings.SingletonId,
            SiteSettingsDefaults.BusinessName,
            SiteSettingsDefaults.Tagline,
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
