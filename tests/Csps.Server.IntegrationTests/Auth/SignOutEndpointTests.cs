using System.Net;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>AUTH-06, AUDIT-01: signing out ends this device's session at once, clears the cookie and always answers 204.</summary>
public sealed class SignOutEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task SigningOutRevokesTheSessionClearsTheCookieAndStopsTheAccessToken()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        (await AuthClient.SiteSettingsStatusAsync(client, device.AccessToken)).ShouldBe(HttpStatusCode.OK);

        using var response = await AuthClient.SignOutAsync(client);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        AuthClient.RefreshCookie(response).ShouldNotBeNull().Expires.ShouldNotBeNull().ShouldBeLessThan(TimeProvider.System.GetUtcNow());
        (await AuthClient.SiteSettingsStatusAsync(client, device.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);
        using var refresh = await AuthClient.RefreshAsync(client, device.RefreshToken);
        refresh.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        await using var context = database.CreateContext();
        var session = await context.UserSessions.AsNoTracking().SingleAsync(s => s.Id == device.SessionId, TestContext.Current.CancellationToken);
        session.RevokedReason.ShouldBe(SessionRevocationReason.SignedOut);
        var sessionKey = device.SessionId.ToString("D");
        var audit = await context.AuditLog.AsNoTracking().SingleAsync(
            entry => entry.TargetId == sessionKey && entry.Action == AuditActions.SignedOut, TestContext.Current.CancellationToken);
        audit.TargetType.ShouldBe("UserSession");
        audit.Detail.ShouldBeNull();
    }

    [Fact]
    public async Task SigningOutWithNoCookieStillAnswers204AndClearsTheCookie()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var response = await AuthClient.SignOutAsync(client);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        AuthClient.RefreshCookie(response).ShouldNotBeNull().Expires.ShouldNotBeNull().ShouldBeLessThan(TimeProvider.System.GetUtcNow());
    }

    [Fact]
    public async Task SigningOutWithAnUnknownCookieAnswers204AndAuditsNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var response = await AuthClient.SignOutAsync(client, "not-a-real-token");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        AuthClient.RefreshCookie(response).ShouldNotBeNull();
    }

    [Fact]
    public async Task SigningOutTwiceAnswers204AndAuditsOnce()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        using var elsewhere = AuthClient.CreateClient(factory);
        using var first = await AuthClient.SignOutAsync(elsewhere, device.RefreshToken);
        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var second = await AuthClient.SignOutAsync(elsewhere, device.RefreshToken);

        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        var sessionKey = device.SessionId.ToString("D");
        (await context.AuditLog.AsNoTracking().CountAsync(
            entry => entry.TargetId == sessionKey && entry.Action == AuditActions.SignedOut, TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task SigningOutWithoutTheAntiCsrfHeaderIsRefusedAndTheSessionSurvives()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        using var response = await AuthClient.SignOutAsync(client, csrf: false);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await AuthClient.SiteSettingsStatusAsync(client, device.AccessToken)).ShouldBe(HttpStatusCode.OK);
        using var refresh = await AuthClient.RefreshAsync(client);
        refresh.StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}
