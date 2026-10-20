using Csps.Infrastructure.Email;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.IntegrationTests.Email;

/// <summary>IN-06, IN-10: email links come from App:PublicBaseUrl alone, which must be a clean https origin (http only for localhost, no user info, no path); tokens ride in the fragment.</summary>
public sealed class AppLinksOptionsTests
{
    [Theory]
    [InlineData("https://carmens.example.com")]
    [InlineData("https://carmens.example.com/")]
    [InlineData("http://localhost:5180")]
    [InlineData("http://127.0.0.1:5180")]
    [InlineData("https://localhost")]
    public void UsableBaseUrlsPassValidation(string baseUrl)
    {
        Validate(baseUrl).Succeeded.ShouldBeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("carmens.example.com")]
    [InlineData("/admin")]
    [InlineData("http://carmens.example.com")]
    [InlineData("ftp://carmens.example.com")]
    [InlineData("https://carmens.example.com/?next=1")]
    [InlineData("https://carmens.example.com/#top")]
    [InlineData("https://staff@evil.example")]
    [InlineData("https://u:p@example.com")]
    [InlineData("https://example.com/anything")]
    [InlineData("https://example.com//")]
    public void UnsafeOrMalformedBaseUrlsFailWithoutEchoingTheValue(string baseUrl)
    {
        var result = Validate(baseUrl);

        result.Failed.ShouldBeTrue();
        result.FailureMessage.ShouldBe(AppLinksOptions.PublicBaseUrlInvalidMessage);
        result.FailureMessage.ShouldContain("App:PublicBaseUrl");
        if (baseUrl.Trim().Length > 0)
        {
            result.FailureMessage.ShouldNotContain(baseUrl);
        }
    }

    [Fact]
    public void TheFailureMessageNamesTheUserInfoAndPathRules()
    {
        AppLinksOptions.PublicBaseUrlInvalidMessage.ShouldContain("user info");
        AppLinksOptions.PublicBaseUrlInvalidMessage.ShouldContain("path");
    }

    [Fact]
    public void LinksAreBuiltFromTheBaseUrlAndTokensGoInTheFragment()
    {
        var links = new AppLinksOptions { PublicBaseUrl = "https://carmens.example.com/" };

        links.ForgotPasswordPage().ShouldBe("https://carmens.example.com/admin/forgot-password");
        links.ResetPasswordLink("abc-DEF_123").ShouldBe("https://carmens.example.com/admin/reset-password#token=abc-DEF_123");
        links.AcceptInviteLink("a b&c").ShouldBe("https://carmens.example.com/admin/accept-invite#token=a%20b%26c");
    }

    private static ValidateOptionsResult Validate(string baseUrl) =>
        new AppLinksOptions.Validator().Validate(name: null, new AppLinksOptions { PublicBaseUrl = baseUrl });
}
