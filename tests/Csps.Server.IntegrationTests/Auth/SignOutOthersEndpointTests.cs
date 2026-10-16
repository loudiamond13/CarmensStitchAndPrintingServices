using System.Net;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>D-05, D-44, AUTH-06, T-04-52: "sign out other devices" ends every other session of the caller, keeps this one and always succeeds.</summary>
public sealed class SignOutOthersEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task OtherDevicesAreSignedOutAndThisOneKeepsWorking()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var clientA = AuthClient.CreateClient(factory);
        using var clientB = AuthClient.CreateClient(factory);
        using var clientC = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var deviceA = await AuthClient.SignInFullyAsync(clientA, staff, signInsSoFar: 0);
        var deviceB = await AuthClient.SignInFullyAsync(clientB, staff, signInsSoFar: 1);
        var deviceC = await AuthClient.SignInFullyAsync(clientC, staff, signInsSoFar: 2);
        foreach (var device in new[] { deviceA, deviceB, deviceC })
        {
            (await AuthClient.SiteSettingsStatusAsync(clientA, device.AccessToken)).ShouldBe(HttpStatusCode.OK);
        }

        using var response = await AuthClient.SignOutOthersAsync(clientA, deviceA.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await AuthClient.SiteSettingsStatusAsync(clientA, deviceB.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);
        (await AuthClient.SiteSettingsStatusAsync(clientA, deviceC.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);
        using var refreshB = await AuthClient.RefreshAsync(clientB);
        refreshB.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        using var refreshC = await AuthClient.RefreshAsync(clientC);
        refreshC.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await AuthClient.SiteSettingsStatusAsync(clientA, deviceA.AccessToken)).ShouldBe(HttpStatusCode.OK);
        using var refreshA = await AuthClient.RefreshAsync(clientA);
        refreshA.StatusCode.ShouldBe(HttpStatusCode.OK);

        await using var context = database.CreateContext();
        var sessions = await context.UserSessions.AsNoTracking().Where(s => s.UserId == staff.Id).ToListAsync(TestContext.Current.CancellationToken);
        sessions.Single(s => s.Id == deviceA.SessionId).RevokedAt.ShouldBeNull();
        foreach (var other in new[] { deviceB, deviceC })
        {
            sessions.Single(s => s.Id == other.SessionId).RevokedReason.ShouldBe(SessionRevocationReason.SignedOutOtherDevices);
        }

        var userKey = staff.Id.ToString("D");
        var audit = await context.AuditLog.AsNoTracking().SingleAsync(
            entry => entry.TargetId == userKey && entry.Action == AuditActions.SessionsRevoked, TestContext.Current.CancellationToken);
        audit.TargetType.ShouldBe("User");
        audit.Detail.ShouldBe("sign-out-others");
        audit.ActorUserId.ShouldBe(staff.Id);
    }

    [Fact]
    public async Task AnotherUsersSessionsAreUntouched()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var mine = AuthClient.CreateClient(factory);
        using var myOther = AuthClient.CreateClient(factory);
        using var theirs = AuthClient.CreateClient(factory);
        var me = await AuthClient.CreateStaffAsync(factory);
        var someoneElse = await AuthClient.CreateStaffAsync(factory);
        var myDevice = await AuthClient.SignInFullyAsync(mine, me, signInsSoFar: 0);
        await AuthClient.SignInFullyAsync(myOther, me, signInsSoFar: 1);
        var theirDevice = await AuthClient.SignInFullyAsync(theirs, someoneElse);

        using var response = await AuthClient.SignOutOthersAsync(mine, myDevice.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await AuthClient.SiteSettingsStatusAsync(theirs, theirDevice.AccessToken)).ShouldBe(HttpStatusCode.OK);
        using var refresh = await AuthClient.RefreshAsync(theirs);
        refresh.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task WithOnlyThisDeviceTheAnswerIs204AndNothingIsRevokedOrAudited()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        using var response = await AuthClient.SignOutOthersAsync(client, device.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await AuthClient.SiteSettingsStatusAsync(client, device.AccessToken)).ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        var userKey = staff.Id.ToString("D");
        (await context.AuditLog.AsNoTracking().CountAsync(
            entry => entry.TargetId == userKey && entry.Action == AuditActions.SessionsRevoked, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AskingTwiceAnswers204BothTimesAndAuditsOnce()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var clientA = AuthClient.CreateClient(factory);
        using var clientB = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var deviceA = await AuthClient.SignInFullyAsync(clientA, staff, signInsSoFar: 0);
        await AuthClient.SignInFullyAsync(clientB, staff, signInsSoFar: 1);
        using var first = await AuthClient.SignOutOthersAsync(clientA, deviceA.AccessToken);
        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var second = await AuthClient.SignOutOthersAsync(clientA, deviceA.AccessToken);

        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        var userKey = staff.Id.ToString("D");
        (await context.AuditLog.AsNoTracking().CountAsync(
            entry => entry.TargetId == userKey && entry.Action == AuditActions.SessionsRevoked, TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task AnAnonymousCallerIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var response = await AuthClient.SignOutOthersAsync(client, null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}
