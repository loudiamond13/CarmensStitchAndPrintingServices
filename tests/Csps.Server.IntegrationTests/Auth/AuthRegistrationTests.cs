using Csps.Application.Auth;
using Csps.Server.Composition;
using Csps.Server.Security;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>D-39, D-38: the Auth section binds over the approved defaults, a bad value stops the start, and the cookies carry their attributes.</summary>
public sealed class AuthRegistrationTests
{
    [Fact]
    public void NoConfigurationGivesTheApprovedDefaults()
    {
        using var provider = Build(new Dictionary<string, string?>());

        var settings = provider.GetRequiredService<AuthSettings>();
        settings.ResponseFloor.ShouldBe(TimeSpan.FromMilliseconds(500));
        settings.ChallengeLifetime.ShouldBe(TimeSpan.FromMinutes(30));
        provider.GetRequiredService<IValidator<SignInRequest>>().ShouldBeOfType<SignInRequestValidator>();
    }

    [Fact]
    public void ConfiguredValuesOverrideTheDefaults()
    {
        using var provider = Build(new Dictionary<string, string?>
        {
            ["Auth:ResponseFloor"] = "00:00:00.250",
            ["Auth:CodeAttempts"] = "3",
        });

        var settings = provider.GetRequiredService<AuthSettings>();
        settings.ResponseFloor.ShouldBe(TimeSpan.FromMilliseconds(250));
        settings.CodeAttempts.ShouldBe(3);
    }

    [Fact]
    public void AnUnusableValueStopsTheStartAndNamesTheSetting()
    {
        var exception = Should.Throw<InvalidOperationException>(() => Build(new Dictionary<string, string?> { ["Auth:CodeAttempts"] = "0" }));

        exception.Message.ShouldBe("Auth:CodeAttempts must be greater than zero.");
    }

    [Fact]
    public void TheCodeKeyInTheSameSectionIsIgnored()
    {
        using var provider = Build(new Dictionary<string, string?> { ["Auth:CodeMacKey"] = "not-read-here" });

        provider.GetRequiredService<AuthSettings>().ShouldNotBeNull();
    }

    [Fact]
    public void RegistrationRejectsNulls()
    {
        Should.Throw<ArgumentNullException>(() => AuthRegistration.AddCspsAuth(null!, new ConfigurationBuilder().Build()));
        Should.Throw<ArgumentNullException>(() => new ServiceCollection().AddCspsAuth(null!));
    }

    [Fact]
    public void TheTicketCookieHasTheAgreedAttributes()
    {
        var context = new DefaultHttpContext();
        var expires = new DateTimeOffset(2026, 10, 14, 9, 0, 0, TimeSpan.Zero);

        AuthCookies.SetTicket(context.Response, "ticket-value", expires);

        var cookie = SetCookieHeaderValue.Parse(context.Response.Headers.SetCookie.ToString());
        cookie.Name.Value.ShouldBe("__Secure-csps_2fa");
        cookie.Value.Value.ShouldBe("ticket-value");
        cookie.HttpOnly.ShouldBeTrue();
        cookie.Secure.ShouldBeTrue();
        cookie.SameSite.ShouldBe(Microsoft.Net.Http.Headers.SameSiteMode.Strict);
        cookie.Path.Value.ShouldBe("/api/v1/auth");
        cookie.Expires.ShouldBe(expires);
        AuthCookies.RefreshCookieName.ShouldBe("__Secure-csps_rt");
        AuthCookies.CookiePath.ShouldBe("/api/v1/auth");
    }

    [Fact]
    public void ClearingTheTicketExpiresItOnTheSamePath()
    {
        var context = new DefaultHttpContext();

        AuthCookies.ClearTicket(context.Response);

        var cookie = SetCookieHeaderValue.Parse(context.Response.Headers.SetCookie.ToString());
        cookie.Name.Value.ShouldBe("__Secure-csps_2fa");
        cookie.Value.Value.ShouldBeNullOrEmpty();
        cookie.Path.Value.ShouldBe("/api/v1/auth");
        cookie.Expires.ShouldNotBeNull().ShouldBeLessThan(TimeProvider.System.GetUtcNow());
    }

    [Fact]
    public void TheTicketCookieNeedsAValue()
    {
        var context = new DefaultHttpContext();

        Should.Throw<ArgumentException>(() => AuthCookies.SetTicket(context.Response, string.Empty, TimeProvider.System.GetUtcNow()));
        Should.Throw<ArgumentNullException>(() => AuthCookies.SetTicket(null!, "ticket", TimeProvider.System.GetUtcNow()));
        Should.Throw<ArgumentNullException>(() => AuthCookies.ClearTicket(null!));
    }

    private static ServiceProvider Build(Dictionary<string, string?> values)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        return new ServiceCollection().AddCspsAuth(configuration).BuildServiceProvider();
    }
}
