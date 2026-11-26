using Csps.Application.QuoteRequests;

namespace Csps.Application.UnitTests.QuoteRequests;

/// <summary>INQ-02, INQ-03, D-25, D-37: every number of the quote form is a setting with a bound, checked at start.</summary>
public sealed class QuoteRequestSettingsTests
{
    [Fact]
    public void TheDefaultsAreValidAndMatchTheOwnersNumbers()
    {
        var settings = new QuoteRequestSettings();

        settings.Validate().ShouldBeNull();
        settings.UploadKeyLifetime.ShouldBe(TimeSpan.FromHours(2));
        settings.MinimumSeconds.ShouldBe(3);
        settings.TicketLifetime.ShouldBe(TimeSpan.FromHours(24));
        settings.PerSenderPerDay.ShouldBe(3);
        settings.AlertsPerHour.ShouldBe(20);
        QuoteRequestSettings.SenderWindow.ShouldBe(TimeSpan.FromHours(24));
        QuoteRequestSettings.SectionName.ShouldBe("QuoteRequests");
    }

    [Theory]
    [InlineData(5)]
    [InlineData(1440)]
    public void AnUploadKeyLifetimeAtEitherEdgeIsAccepted(int minutes)
    {
        new QuoteRequestSettings { UploadKeyLifetime = TimeSpan.FromMinutes(minutes) }.Validate().ShouldBeNull();
    }

    [Theory]
    [InlineData(4)]
    [InlineData(1441)]
    public void AnUploadKeyLifetimeJustOutsideTheRangeIsRefused(int minutes)
    {
        new QuoteRequestSettings { UploadKeyLifetime = TimeSpan.FromMinutes(minutes) }.Validate()
            .ShouldBe("QuoteRequests:UploadKeyLifetime must be from 5 minutes to 24 hours.");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(60)]
    public void AMinimumTimeAtEitherEdgeIsAccepted(int seconds)
    {
        new QuoteRequestSettings { MinimumSeconds = seconds }.Validate().ShouldBeNull();
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(61)]
    public void AMinimumTimeJustOutsideTheRangeIsRefused(int seconds)
    {
        new QuoteRequestSettings { MinimumSeconds = seconds }.Validate().ShouldBe("QuoteRequests:MinimumSeconds must be from 0 to 60.");
    }

    [Theory]
    [InlineData(1)]
    [InlineData(50)]
    public void APerSenderLimitAtEitherEdgeIsAccepted(int perDay)
    {
        new QuoteRequestSettings { PerSenderPerDay = perDay }.Validate().ShouldBeNull();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    [InlineData(51)]
    public void APerSenderLimitJustOutsideTheRangeIsRefused(int perDay)
    {
        new QuoteRequestSettings { PerSenderPerDay = perDay }.Validate().ShouldBe("QuoteRequests:PerSenderPerDay must be from 1 to 50.");
    }

    [Theory]
    [InlineData(1)]
    [InlineData(200)]
    public void AnAlertsPerHourAtEitherEdgeIsAccepted(int perHour)
    {
        new QuoteRequestSettings { AlertsPerHour = perHour }.Validate().ShouldBeNull();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(201)]
    public void AnAlertsPerHourJustOutsideTheRangeIsRefused(int perHour)
    {
        new QuoteRequestSettings { AlertsPerHour = perHour }.Validate().ShouldBe("QuoteRequests:AlertsPerHour must be from 1 to 200.");
    }

    [Theory]
    [InlineData(1)]
    [InlineData(72)]
    public void ATicketLifetimeAtEitherEdgeIsAccepted(int hours)
    {
        new QuoteRequestSettings { TicketLifetime = TimeSpan.FromHours(hours) }.Validate().ShouldBeNull();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(73)]
    public void ATicketLifetimeJustOutsideTheRangeIsRefused(int hours)
    {
        new QuoteRequestSettings { TicketLifetime = TimeSpan.FromHours(hours) }.Validate().ShouldBe("QuoteRequests:TicketLifetime must be from 1 to 72 hours.");
    }

    [Fact]
    public void ABadValueIsNamedAndNeverEchoed()
    {
        var message = new QuoteRequestSettings { MinimumSeconds = 987654 }.Validate().ShouldNotBeNull();

        message.ShouldNotContain("987654");
    }
}
