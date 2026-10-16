using System.Net;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>AUTH-05, D-39, T-04-50, T-04-54: tabs refreshing together, replayed tokens and the fixed session end, over real HTTP.</summary>
public sealed class RefreshRotationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task TwoTabsRefreshingWithTheSameCookieBothSucceedAndBothKeepWorking()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        using var tabA = AuthClient.CreateClient(factory);
        using var tabB = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        var calls = await Task.WhenAll(
            AuthClient.RefreshAsync(tabA, device.RefreshToken),
            AuthClient.RefreshAsync(tabB, device.RefreshToken));

        try
        {
            calls.ShouldAllBe(response => response.StatusCode == HttpStatusCode.OK);
            var cookies = calls.Select(response => AuthClient.RefreshCookie(response).ShouldNotBeNull().Value.Value.ShouldNotBeNull()).ToList();
            cookies.Distinct().Count().ShouldBe(2);
            foreach (var cookie in cookies)
            {
                using var next = await AuthClient.RefreshAsync(client, cookie);
                next.StatusCode.ShouldBe(HttpStatusCode.OK);
            }
        }
        finally
        {
            foreach (var call in calls)
            {
                call.Dispose();
            }
        }
    }

    [Fact]
    public async Task ReplayingAUsedTokenAfterTheGraceWindowRevokesTheWholeSession()
    {
        var clock = new SteppedClock();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = AuthClient.CreateClient(factory);
        using var thief = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        using var first = await AuthClient.RefreshAsync(client);
        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        var newest = await AuthClient.ReadDeviceAsync(first, staff.Id);
        (await AuthClient.SiteSettingsStatusAsync(client, newest.AccessToken)).ShouldBe(HttpStatusCode.OK);
        clock.Advance(TimeSpan.FromSeconds(31));

        using var replay = await AuthClient.RefreshAsync(thief, device.RefreshToken);

        await RefreshEndpointTests.ShouldBeSessionEndedAsync(replay);
        using var newestCookie = await AuthClient.RefreshAsync(thief, newest.RefreshToken);
        await RefreshEndpointTests.ShouldBeSessionEndedAsync(newestCookie);
        (await AuthClient.SiteSettingsStatusAsync(client, newest.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);
        await using var context = database.CreateContext();
        var session = await context.UserSessions.AsNoTracking().SingleAsync(s => s.Id == device.SessionId, TestContext.Current.CancellationToken);
        session.RevokedReason.ShouldBe(SessionRevocationReason.ReuseDetected);
        var sessionKey = device.SessionId.ToString("D");
        var audit = await context.AuditLog.AsNoTracking().SingleAsync(
            entry => entry.TargetId == sessionKey && entry.Action == AuditActions.RefreshReuseDetected, TestContext.Current.CancellationToken);
        audit.TargetType.ShouldBe("UserSession");
        audit.ActorUserId.ShouldBeNull();
        audit.Detail.ShouldBeNull();
    }

    [Fact]
    public async Task ReplayingAUsedTokenInsideTheGraceWindowIsNotAnAlarm()
    {
        var clock = new SteppedClock();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = AuthClient.CreateClient(factory);
        using var otherTab = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        using var first = await AuthClient.RefreshAsync(client);
        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        clock.Advance(TimeSpan.FromSeconds(29));

        using var late = await AuthClient.RefreshAsync(otherTab, device.RefreshToken);

        late.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ABrowserSessionRefreshedAtExactlyTwelveHoursIsRefused()
    {
        var clock = new SteppedClock();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        await AuthClient.SignInFullyAsync(client, staff, keepSignedIn: false);
        clock.Advance(TimeSpan.FromHours(12) - TimeSpan.FromSeconds(1));
        using var justBefore = await AuthClient.RefreshAsync(client);
        justBefore.StatusCode.ShouldBe(HttpStatusCode.OK);
        clock.Advance(TimeSpan.FromSeconds(1));

        using var atTheEnd = await AuthClient.RefreshAsync(client);

        await RefreshEndpointTests.ShouldBeSessionEndedAsync(atTheEnd);
    }

    [Fact]
    public async Task APersistentSessionRefreshedAt89DaysKeepsItsExpiry()
    {
        var clock = new SteppedClock();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff, keepSignedIn: true);
        clock.Advance(TimeSpan.FromDays(89));

        using var response = await AuthClient.RefreshAsync(client);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var renewed = await AuthClient.ReadDeviceAsync(response, staff.Id);
        renewed.SessionExpiresAt.ShouldBe(device.SessionExpiresAt);
        renewed.CookieExpires.ShouldBe(device.CookieExpires);
        clock.Advance(TimeSpan.FromDays(1));
        using var atTheEnd = await AuthClient.RefreshAsync(client);
        await RefreshEndpointTests.ShouldBeSessionEndedAsync(atTheEnd);
    }
}
