using Csps.Application.Auth;
using Csps.Domain.Identity;

namespace Csps.Application.UnitTests.Auth;

/// <summary>D-39, AUTH-05: the sign-in limits default to the approved values and map onto the Domain settings.</summary>
public sealed class AuthSettingsTests
{
    [Fact]
    public void DefaultsAreTheApprovedLimits()
    {
        var settings = new AuthSettings();

        settings.ResponseFloor.ShouldBe(TimeSpan.FromMilliseconds(500));
        settings.CodeLifetime.ShouldBe(TimeSpan.FromMinutes(15));
        settings.CodeAttempts.ShouldBe(5);
        settings.ResendCooldown.ShouldBe(TimeSpan.FromSeconds(60));
        settings.SendsPerHour.ShouldBe(5);
        settings.AccountFailureCap.ShouldBe(10);
        settings.ChallengeLifetime.ShouldBe(TimeSpan.FromMinutes(30));
        settings.AccessTokenLifetime.ShouldBe(TimeSpan.FromMinutes(15));
        settings.PersistentSessionLifetime.ShouldBe(TimeSpan.FromDays(90));
        settings.BrowserSessionLifetime.ShouldBe(TimeSpan.FromHours(12));
        settings.RefreshGrace.ShouldBe(TimeSpan.FromSeconds(30));
        settings.GraceSiblingCap.ShouldBe(5);
        settings.ResetLinkLifetime.ShouldBe(TimeSpan.FromMinutes(30));
        settings.ResetEmailsPerHour.ShouldBe(3);
        settings.InviteLinkLifetime.ShouldBe(TimeSpan.FromHours(72));
        AuthSettings.SectionName.ShouldBe("Auth");
    }

    [Fact]
    public void DefaultsMatchTheDomainDefaults()
    {
        var settings = new AuthSettings();

        settings.ToTwoFactorSettings().ShouldBe(TwoFactorSettings.Default);
        settings.ToSessionSettings().ShouldBe(SessionSettings.Default);
    }

    [Fact]
    public void ChangedValuesReachTheDomainSettings()
    {
        var settings = new AuthSettings
        {
            CodeLifetime = TimeSpan.FromMinutes(10),
            CodeAttempts = 3,
            ResendCooldown = TimeSpan.FromSeconds(90),
            SendsPerHour = 4,
            AccountFailureCap = 8,
            ChallengeLifetime = TimeSpan.FromMinutes(20),
            PersistentSessionLifetime = TimeSpan.FromDays(30),
            BrowserSessionLifetime = TimeSpan.FromHours(6),
            RefreshGrace = TimeSpan.FromSeconds(15),
            GraceSiblingCap = 2,
        };

        var twoFactor = settings.ToTwoFactorSettings();
        twoFactor.CodeLifetime.ShouldBe(TimeSpan.FromMinutes(10));
        twoFactor.MaxAttemptsPerCode.ShouldBe(3);
        twoFactor.ResendCooldown.ShouldBe(TimeSpan.FromSeconds(90));
        twoFactor.MaxSendsPerWindow.ShouldBe(4);
        twoFactor.AccountFailureCap.ShouldBe(8);
        twoFactor.ChallengeLifetime.ShouldBe(TimeSpan.FromMinutes(20));
        var session = settings.ToSessionSettings();
        session.PersistentLifetime.ShouldBe(TimeSpan.FromDays(30));
        session.BrowserSessionLifetime.ShouldBe(TimeSpan.FromHours(6));
        session.RefreshGrace.ShouldBe(TimeSpan.FromSeconds(15));
        session.MaxGraceSiblings.ShouldBe(2);
    }

    [Fact]
    public void DefaultsAreValid() => new AuthSettings().Validate().ShouldBeEmpty();

    [Fact]
    public void EveryNonPositiveValueIsReportedByName()
    {
        var settings = new AuthSettings
        {
            ResponseFloor = TimeSpan.Zero,
            CodeLifetime = TimeSpan.Zero,
            ResendCooldown = TimeSpan.Zero,
            ChallengeLifetime = TimeSpan.Zero,
            AccessTokenLifetime = TimeSpan.Zero,
            PersistentSessionLifetime = TimeSpan.Zero,
            BrowserSessionLifetime = TimeSpan.Zero,
            RefreshGrace = TimeSpan.Zero,
            ResetLinkLifetime = TimeSpan.Zero,
            InviteLinkLifetime = TimeSpan.Zero,
            CodeAttempts = 0,
            SendsPerHour = 0,
            AccountFailureCap = 0,
            GraceSiblingCap = 0,
            ResetEmailsPerHour = 0,
        };

        var problems = settings.Validate();

        problems.Count.ShouldBe(15);
        problems.ShouldAllBe(problem => problem.StartsWith("Auth:", StringComparison.Ordinal) && problem.EndsWith("must be greater than zero.", StringComparison.Ordinal));
        problems.ShouldContain("Auth:ResponseFloor must be greater than zero.");
        problems.ShouldContain("Auth:ResetEmailsPerHour must be greater than zero.");
    }
}
