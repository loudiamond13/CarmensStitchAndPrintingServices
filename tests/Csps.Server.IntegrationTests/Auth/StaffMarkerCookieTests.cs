using System.Net;
using Csps.Domain.Identity;
using Csps.Server.Security;
using Csps.Testing;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>
/// D-21, Pitfall 7: the staff marker <c>__Secure-csps_staff</c> is set wherever the refresh cookie is set and deleted wherever it is cleared,
/// so signed-in staff browsing the public site are recognized. The refresh cookie keeps its own path <c>/api/v1/auth</c>.
/// </summary>
public sealed class StaffMarkerCookieTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string MarkerName = "__Secure-csps_staff";
    private const string MarkerPath = "/api/v1/analytics";
    private const string RefreshPath = "/api/v1/auth";

    [Fact]
    public async Task ATwoFactorSignInSetsBothCookiesEachWithItsOwnPathAndTheSameExpiry()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password, keepSignedIn: true);
        var code = await AuthClient.ReadCodeAsync(client, staff.Email);

        using var response = await AuthClient.VerifyAsync(client, code);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var refresh = CookieNamed(response, AuthClient.RefreshCookieName).ShouldNotBeNull();
        var marker = CookieNamed(response, MarkerName).ShouldNotBeNull();
        refresh.Path.Value.ShouldBe(RefreshPath);
        marker.Path.Value.ShouldBe(MarkerPath);
        marker.Value.Value.ShouldBe("1");
        marker.HttpOnly.ShouldBeTrue();
        marker.Secure.ShouldBeTrue();
        marker.SameSite.ShouldBe(SameSiteMode.Strict);
        marker.Expires.ShouldNotBeNull().ShouldBe(refresh.Expires.ShouldNotBeNull(), TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task ABrowserSessionSignInSetsBothCookiesWithNoExpiry()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password, keepSignedIn: false);
        var code = await AuthClient.ReadCodeAsync(client, staff.Email);

        using var response = await AuthClient.VerifyAsync(client, code);

        var refresh = CookieNamed(response, AuthClient.RefreshCookieName).ShouldNotBeNull();
        var marker = CookieNamed(response, MarkerName).ShouldNotBeNull();
        refresh.Expires.ShouldBeNull();
        marker.Expires.ShouldBeNull();
        marker.Value.Value.ShouldBe("1");
    }

    [Fact]
    public async Task ARefreshRotationSetsBothCookiesAgain()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        await AuthClient.SignInFullyAsync(client, staff);

        using var response = await AuthClient.RefreshAsync(client);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var refresh = CookieNamed(response, AuthClient.RefreshCookieName).ShouldNotBeNull();
        var marker = CookieNamed(response, MarkerName).ShouldNotBeNull();
        refresh.Path.Value.ShouldBe(RefreshPath);
        marker.Path.Value.ShouldBe(MarkerPath);
        marker.Expires.ShouldNotBeNull().ShouldBe(refresh.Expires.ShouldNotBeNull(), TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task SignOutDeletesBothCookiesEachWithItsOwnPath()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        await AuthClient.SignInFullyAsync(client, staff);

        using var response = await AuthClient.SignOutAsync(client);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        AssertDeleted(CookieNamed(response, AuthClient.RefreshCookieName), RefreshPath);
        AssertDeleted(CookieNamed(response, MarkerName), MarkerPath);
    }

    [Fact]
    public async Task ARefreshWithAnUnknownCookieDeletesBothCookies()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var response = await AuthClient.RefreshAsync(client, new string('q', 43));

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        AssertDeleted(CookieNamed(response, AuthClient.RefreshCookieName), RefreshPath);
        AssertDeleted(CookieNamed(response, MarkerName), MarkerPath);
    }

    [Fact]
    public async Task TheSetNewPasswordStepSetsBothCookies()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffWithPasswordAsync(factory, "Tela-Sukat-7381", PasswordChangeReason.Temporary);
        using var verified = await AuthClient.SignInThroughCodeAsync(client, staff);
        verified.StatusCode.ShouldBe(HttpStatusCode.OK);
        CookieNamed(verified, MarkerName).ShouldBeNull("no session yet, so no marker");

        using var response = await AuthClient.SetNewPasswordAsync(client, "Mabuhay#Tahi2026");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        CookieNamed(response, AuthClient.RefreshCookieName).ShouldNotBeNull().Path.Value.ShouldBe(RefreshPath);
        CookieNamed(response, MarkerName).ShouldNotBeNull().Path.Value.ShouldBe(MarkerPath);
    }

    [Fact]
    public async Task AFailedSignInSetsNoStaffMarker()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);

        using var response = await AuthClient.SignInAsync(client, staff.Email, "wrong-password-value");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        CookieNamed(response, MarkerName).ShouldBeNull();
    }

    [Fact]
    public void TheMarkerNameAndPathAreFixed()
    {
        AnalyticsCookies.StaffCookieName.ShouldBe(MarkerName);
        AnalyticsCookies.CookiePath.ShouldBe(MarkerPath);
        AuthCookies.CookiePath.ShouldBe(RefreshPath);
    }

    private static SetCookieHeaderValue? CookieNamed(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues("Set-Cookie", out var headers)
            ? headers.Select(static header => SetCookieHeaderValue.Parse(header)).SingleOrDefault(cookie => cookie.Name.Value == name)
            : null;

    private static void AssertDeleted(SetCookieHeaderValue? cookie, string path)
    {
        cookie.ShouldNotBeNull();
        cookie.Value.Value.ShouldBeNullOrEmpty();
        cookie.Path.Value.ShouldBe(path);
        cookie.Expires.ShouldNotBeNull().ShouldBeLessThan(TimeProvider.System.GetUtcNow());
    }
}
