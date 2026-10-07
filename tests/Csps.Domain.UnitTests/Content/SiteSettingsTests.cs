using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

public sealed class SiteSettingsTests
{
    [Fact]
    public void CreateDefaultUsesPlaceholderValues()
    {
        var createdAt = new DateTimeOffset(2026, 10, 7, 1, 2, 3, TimeSpan.Zero);

        var settings = SiteSettings.CreateDefault(createdAt);

        settings.Id.ShouldBe(SiteSettings.SingletonId);
        settings.Id.ShouldBe(1);
        settings.BusinessName.ShouldBe("Carmen's Stitch & Printing Services");
        settings.TimeZoneId.ShouldBe("Asia/Manila");
        settings.CurrencyCode.ShouldBe("PHP");
        settings.Locale.ShouldBe("en-PH");
        settings.ContactEmail.ShouldBe("[hello@yourdomain.ph]");
        settings.ContactPhone.ShouldBe("[0917 000 0000]");
        settings.AddressLine.ShouldBe("[Shop address], [City], Philippines");
        settings.FacebookUrl.ShouldBe("[Facebook page URL]");
        settings.CreatedAtUtc.ShouldBe(createdAt);
        settings.CreatedByUserId.ShouldBeNull();
        settings.UpdatedAtUtc.ShouldBeNull();
        settings.UpdatedByUserId.ShouldBeNull();
        settings.RowVersion.ShouldBeEmpty();
    }

    [Fact]
    public void DefaultsFitTheirColumnLengths()
    {
        SiteSettingsDefaults.BusinessName.Length.ShouldBeLessThanOrEqualTo(SiteSettings.BusinessNameMaxLength);
        SiteSettingsDefaults.TimeZoneId.Length.ShouldBeLessThanOrEqualTo(SiteSettings.TimeZoneIdMaxLength);
        SiteSettingsDefaults.CurrencyCode.Length.ShouldBe(SiteSettings.CurrencyCodeMaxLength);
        SiteSettingsDefaults.Locale.Length.ShouldBeLessThanOrEqualTo(SiteSettings.LocaleMaxLength);
        SiteSettingsDefaults.ContactEmail.Length.ShouldBeLessThanOrEqualTo(SiteSettings.ContactEmailMaxLength);
        SiteSettingsDefaults.ContactPhone.Length.ShouldBeLessThanOrEqualTo(SiteSettings.ContactPhoneMaxLength);
        SiteSettingsDefaults.AddressLine.Length.ShouldBeLessThanOrEqualTo(SiteSettings.AddressLineMaxLength);
        SiteSettingsDefaults.FacebookUrl.Length.ShouldBeLessThanOrEqualTo(SiteSettings.FacebookUrlMaxLength);
    }

    [Fact]
    public void SeedStampIsAFixedUtcLiteral()
    {
        SiteSettingsDefaults.SeededAtUtc.ShouldBe(new DateTimeOffset(2026, 10, 7, 0, 0, 0, TimeSpan.Zero));
    }
}
