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

    [Fact]
    public void ResetToSeedDefaultsReturnsFalseWhenEqual()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        settings.ResetToSeedDefaults(ResetAt).ShouldBeFalse();

        settings.UpdatedAtUtc.ShouldBeNull("An unchanged row must not be stamped.");
        settings.BusinessName.ShouldBe(SiteSettingsDefaults.BusinessName);
    }

    [Theory]
    [InlineData(nameof(SiteSettings.BusinessName))]
    [InlineData(nameof(SiteSettings.TimeZoneId))]
    [InlineData(nameof(SiteSettings.CurrencyCode))]
    [InlineData(nameof(SiteSettings.Locale))]
    [InlineData(nameof(SiteSettings.ContactEmail))]
    [InlineData(nameof(SiteSettings.ContactPhone))]
    [InlineData(nameof(SiteSettings.AddressLine))]
    [InlineData(nameof(SiteSettings.FacebookUrl))]
    public void ResetToSeedDefaultsReturnsTrueAndStampsUpdatedAtWhenDifferent(string property)
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        // The aggregate has no editing API yet (a later phase adds it), so the drift is simulated through the private setter.
        typeof(SiteSettings).GetProperty(property)!.SetValue(settings, "Drifted value");

        settings.ResetToSeedDefaults(ResetAt).ShouldBeTrue();

        settings.UpdatedAtUtc.ShouldBe(ResetAt);
        settings.UpdatedByUserId.ShouldBeNull();
        settings.CreatedAtUtc.ShouldBe(CreatedAt);
        settings.BusinessName.ShouldBe(SiteSettingsDefaults.BusinessName);
        settings.TimeZoneId.ShouldBe(SiteSettingsDefaults.TimeZoneId);
        settings.CurrencyCode.ShouldBe(SiteSettingsDefaults.CurrencyCode);
        settings.Locale.ShouldBe(SiteSettingsDefaults.Locale);
        settings.ContactEmail.ShouldBe(SiteSettingsDefaults.ContactEmail);
        settings.ContactPhone.ShouldBe(SiteSettingsDefaults.ContactPhone);
        settings.AddressLine.ShouldBe(SiteSettingsDefaults.AddressLine);
        settings.FacebookUrl.ShouldBe(SiteSettingsDefaults.FacebookUrl);
    }

    [Fact]
    public void ResetToSeedDefaultsComparesOrdinally()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);
        typeof(SiteSettings).GetProperty(nameof(SiteSettings.BusinessName))!
            .SetValue(settings, SiteSettingsDefaults.BusinessName.ToUpperInvariant());

        settings.ResetToSeedDefaults(ResetAt).ShouldBeTrue("A case-only difference is still a difference.");

        settings.BusinessName.ShouldBe(SiteSettingsDefaults.BusinessName);
    }

    private static readonly DateTimeOffset CreatedAt = new(2026, 10, 7, 1, 2, 3, TimeSpan.Zero);

    private static readonly DateTimeOffset ResetAt = new(2026, 10, 8, 4, 5, 6, TimeSpan.Zero);
}
