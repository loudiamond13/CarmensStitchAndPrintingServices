using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Auth;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Sessions;

/// <summary>D-43, AUTH-06, CWE-639: the signed-in devices list shows, and signs out, the caller's own sessions only.</summary>
public sealed class SessionsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string EdgeOnWindows =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";

    [Fact]
    public async Task TwoDevicesAreListedWithThisOneFirstAndMarked()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var phone = AuthClient.CreateClient(factory);
        using var laptop = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var phoneDevice = await AuthClient.SignInFullyAsync(phone, staff, keepSignedIn: true, signInsSoFar: 0);
        var laptopDevice = await AuthClient.SignInFullyAsync(laptop, staff, keepSignedIn: false, signInsSoFar: 1, userAgent: EdgeOnWindows);

        using var response = await AuthClient.ListSessionsAsync(laptop, laptopDevice.AccessToken);
        var devices = await AuthClient.ReadSessionsAsync(laptop, laptopDevice.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        devices.Count.ShouldBe(2);
        devices[0].Id.ShouldBe(laptopDevice.SessionId);
        devices[0].Device.ShouldBe("Edge on Windows");
        devices[0].Current.ShouldBeTrue();
        devices[0].Persistent.ShouldBeFalse();
        devices[1].Id.ShouldBe(phoneDevice.SessionId);
        devices[1].Device.ShouldBe("Chrome on Android");
        devices[1].Current.ShouldBeFalse();
        devices[1].Persistent.ShouldBeTrue();
        devices[1].SignedInAt.ShouldBeLessThanOrEqualTo(devices[0].SignedInAt);
        devices[1].LastActiveAt.ShouldBeGreaterThanOrEqualTo(devices[1].SignedInAt);
        devices.ShouldAllBe(device => device.SignedInAt.Offset == TimeSpan.Zero && device.LastActiveAt.Offset == TimeSpan.Zero);
    }

    [Fact]
    public async Task AnotherUsersSessionsNeverAppear()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var mine = AuthClient.CreateClient(factory);
        using var theirs = AuthClient.CreateClient(factory);
        var me = await AuthClient.CreateStaffAsync(factory);
        var someoneElse = await AuthClient.CreateStaffAsync(factory);
        var myDevice = await AuthClient.SignInFullyAsync(mine, me);
        var theirDevice = await AuthClient.SignInFullyAsync(theirs, someoneElse);

        var devices = await AuthClient.ReadSessionsAsync(mine, myDevice.AccessToken);

        devices.Select(device => device.Id).ShouldBe([myDevice.SessionId]);
        devices.ShouldNotContain(device => device.Id == theirDevice.SessionId);
    }

    [Fact]
    public async Task ASignedOutDeviceDisappearsFromTheList()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var phone = AuthClient.CreateClient(factory);
        using var laptop = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        await AuthClient.SignInFullyAsync(phone, staff, signInsSoFar: 0);
        var laptopDevice = await AuthClient.SignInFullyAsync(laptop, staff, signInsSoFar: 1, userAgent: EdgeOnWindows);
        (await AuthClient.ReadSessionsAsync(laptop, laptopDevice.AccessToken)).Count.ShouldBe(2);
        using var signedOut = await AuthClient.SignOutAsync(phone);
        signedOut.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var devices = await AuthClient.ReadSessionsAsync(laptop, laptopDevice.AccessToken);

        devices.Select(device => device.Id).ShouldBe([laptopDevice.SessionId]);
    }

    [Fact]
    public async Task AnAnonymousCallerIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var response = await AuthClient.ListSessionsAsync(client, null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task SigningOutAnotherDeviceStopsItsTokenAndCookieAndAnswersNotAlreadySignedOut()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var phone = AuthClient.CreateClient(factory);
        using var laptop = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var phoneDevice = await AuthClient.SignInFullyAsync(phone, staff, signInsSoFar: 0);
        var laptopDevice = await AuthClient.SignInFullyAsync(laptop, staff, signInsSoFar: 1, userAgent: EdgeOnWindows);

        using var response = await AuthClient.RevokeSessionAsync(laptop, laptopDevice.AccessToken, phoneDevice.SessionId);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        (await AlreadySignedOutAsync(response)).ShouldBeFalse();
        (await AuthClient.SiteSettingsStatusAsync(phone, phoneDevice.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);
        using var refresh = await AuthClient.RefreshAsync(phone);
        refresh.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await AuthClient.SiteSettingsStatusAsync(laptop, laptopDevice.AccessToken)).ShouldBe(HttpStatusCode.OK);
        (await AuthClient.ReadSessionsAsync(laptop, laptopDevice.AccessToken)).Select(device => device.Id).ShouldBe([laptopDevice.SessionId]);
        await using var context = database.CreateContext();
        var stored = await context.UserSessions.AsNoTracking().SingleAsync(s => s.Id == phoneDevice.SessionId, TestContext.Current.CancellationToken);
        stored.RevokedReason.ShouldBe(SessionRevocationReason.DeviceSignedOut);
    }

    [Fact]
    public async Task RepeatingTheSignOutIsAnAlreadySignedOutSuccessAndAuditsOnce()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var phone = AuthClient.CreateClient(factory);
        using var laptop = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var phoneDevice = await AuthClient.SignInFullyAsync(phone, staff, signInsSoFar: 0);
        var laptopDevice = await AuthClient.SignInFullyAsync(laptop, staff, signInsSoFar: 1, userAgent: EdgeOnWindows);
        using var first = await AuthClient.RevokeSessionAsync(laptop, laptopDevice.AccessToken, phoneDevice.SessionId);
        first.StatusCode.ShouldBe(HttpStatusCode.OK);

        using var second = await AuthClient.RevokeSessionAsync(laptop, laptopDevice.AccessToken, phoneDevice.SessionId);

        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await AlreadySignedOutAsync(second)).ShouldBeTrue();
        await using var context = database.CreateContext();
        var key = phoneDevice.SessionId.ToString("D");
        var audit = await context.AuditLog.AsNoTracking().SingleAsync(
            entry => entry.TargetId == key && entry.Action == AuditActions.SessionRevoked, TestContext.Current.CancellationToken);
        audit.TargetType.ShouldBe("UserSession");
        audit.ActorUserId.ShouldBe(staff.Id);
    }

    [Fact]
    public async Task SigningOutTheCurrentSessionIsRefusedAndTheSessionKeepsWorking()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        using var response = await AuthClient.RevokeSessionAsync(client, device.AccessToken, device.SessionId);

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await CodeAsync(response)).ShouldBe("sessions.current");
        (await AuthClient.SiteSettingsStatusAsync(client, device.AccessToken)).ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        var key = device.SessionId.ToString("D");
        (await context.AuditLog.AsNoTracking().CountAsync(
            entry => entry.TargetId == key && entry.Action == AuditActions.SessionRevoked, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AnotherUsersSessionEvenForAManagerAndAnUnknownIdGetTheSameNotFoundAndChangeNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var mine = AuthClient.CreateClient(factory);
        using var theirs = AuthClient.CreateClient(factory);
        var manager = await AuthClient.CreateStaffAsync(factory, role: Roles.Manager);
        var admin = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var managerDevice = await AuthClient.SignInFullyAsync(mine, manager);
        var adminDevice = await AuthClient.SignInFullyAsync(theirs, admin);

        using var foreign = await AuthClient.RevokeSessionAsync(mine, managerDevice.AccessToken, adminDevice.SessionId);
        using var unknown = await AuthClient.RevokeSessionAsync(mine, managerDevice.AccessToken, Guid.NewGuid());

        foreign.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        unknown.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await CodeAsync(foreign)).ShouldBe("sessions.not-found");
        (await CodeAsync(unknown)).ShouldBe("sessions.not-found");
        (await AuthClient.SiteSettingsStatusAsync(theirs, adminDevice.AccessToken)).ShouldBe(HttpStatusCode.OK);
        using var refresh = await AuthClient.RefreshAsync(theirs);
        refresh.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        (await context.AuditLog.AsNoTracking().CountAsync(
            entry => entry.Action == AuditActions.SessionRevoked && (entry.ActorUserId == manager.Id || entry.ActorUserId == admin.Id),
            TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AnAnonymousSignOutIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var response = await AuthClient.RevokeSessionAsync(client, null, Guid.NewGuid());

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    private static async Task<bool> AlreadySignedOutAsync(HttpResponseMessage response)
    {
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return body.RootElement.GetProperty("alreadySignedOut").GetBoolean();
    }

    private static async Task<string?> CodeAsync(HttpResponseMessage response)
    {
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return body.RootElement.GetProperty("code").GetString();
    }
}
