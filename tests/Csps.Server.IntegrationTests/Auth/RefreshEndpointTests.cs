using System.Net;
using System.Text.Json;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>AUTH-05, D-43: the refresh cookie renews the access token, rotates to a single-use token and never moves the session's end.</summary>
public sealed class RefreshEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task ARefreshRenewsTheAccessTokenAndRotatesTheCookieOnTheSameExpiry()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff, keepSignedIn: true);

        using var response = await AuthClient.RefreshAsync(client);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var root = body.RootElement;
        var accessToken = root.GetProperty("accessToken").GetString().ShouldNotBeNull();
        accessToken.ShouldNotBe(device.AccessToken);
        var token = new JsonWebToken(accessToken);
        token.GetClaim("sid").Value.ShouldBe(device.SessionId.ToString("D"));
        token.GetClaim("sub").Value.ShouldBe(staff.Id.ToString("D"));
        root.GetProperty("sessionExpiresAt").GetDateTimeOffset().ShouldBe(device.SessionExpiresAt);
        root.GetProperty("persistent").GetBoolean().ShouldBeTrue();
        root.GetProperty("user").GetProperty("id").GetGuid().ShouldBe(staff.Id);
        root.GetProperty("user").GetProperty("role").GetString().ShouldBe("Manager");

        var rotated = AuthClient.RefreshCookie(response).ShouldNotBeNull();
        rotated.Value.Value.ShouldNotBeNullOrWhiteSpace();
        rotated.Value.Value.ShouldNotBe(device.RefreshToken);
        rotated.HttpOnly.ShouldBeTrue();
        rotated.Secure.ShouldBeTrue();
        rotated.Path.Value.ShouldBe("/api/v1/auth");
        rotated.Expires.ShouldBe(device.CookieExpires);

        (await AuthClient.SiteSettingsStatusAsync(client, accessToken)).ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        var session = await context.UserSessions.AsNoTracking().SingleAsync(s => s.Id == device.SessionId, TestContext.Current.CancellationToken);
        session.LastActiveAt.ShouldBeGreaterThan(session.CreatedAt);
        session.AbsoluteExpiresAt.ShouldBe(device.SessionExpiresAt);
    }

    [Fact]
    public async Task TheRotatedCookieRefreshesAgain()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        await AuthClient.SignInFullyAsync(client, staff);
        using var first = await AuthClient.RefreshAsync(client);
        first.StatusCode.ShouldBe(HttpStatusCode.OK);

        using var second = await AuthClient.RefreshAsync(client);

        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        AuthClient.RefreshCookie(second).ShouldNotBeNull().Value.Value.ShouldNotBe(AuthClient.RefreshCookie(first).ShouldNotBeNull().Value.Value);
    }

    [Fact]
    public async Task ABrowserSessionKeepsAnExpiryFreeCookie()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        await AuthClient.SignInFullyAsync(client, staff, keepSignedIn: false);

        using var response = await AuthClient.RefreshAsync(client);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var raw = response.Headers.GetValues("Set-Cookie").Single(static header => header.StartsWith("__Secure-csps_rt=", StringComparison.Ordinal));
        raw.ShouldNotContain("expires=", Case.Insensitive);
    }

    [Fact]
    public async Task NoCookieIsASessionEndedAnswerThatDeletesTheCookie()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var response = await AuthClient.RefreshAsync(client);

        await ShouldBeSessionEndedAsync(response);
    }

    [Fact]
    public async Task AnUnknownTokenIsASessionEndedAnswerThatDeletesTheCookie()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var response = await AuthClient.RefreshAsync(client, "not-a-real-token");

        await ShouldBeSessionEndedAsync(response);
    }

    [Fact]
    public async Task ARefreshWithoutTheAntiCsrfHeaderIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        await AuthClient.SignInFullyAsync(client, staff);

        using var response = await AuthClient.RefreshAsync(client, csrf: false);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("auth.csrf-check-failed");
    }

    internal static async Task ShouldBeSessionEndedAsync(HttpResponseMessage response)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("auth.session-ended");
        problem.GetProperty("detail").GetString().ShouldBe("Your session ended. Sign in again.");
        var cleared = AuthClient.RefreshCookie(response).ShouldNotBeNull();
        cleared.Expires.ShouldNotBeNull().ShouldBeLessThan(TimeProvider.System.GetUtcNow());
    }
}
