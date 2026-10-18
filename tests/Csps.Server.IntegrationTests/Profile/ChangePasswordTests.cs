using System.Net;
using System.Net.Http.Json;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Profile;

/// <summary>
/// PROF-03, D-41 Q9, T-05-31, T-05-32: a signed-in staff member changes their password from My Profile after entering
/// the current one. This device stays signed in, every other device is signed out, and the notice email goes out.
/// </summary>
public sealed class ChangePasswordTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/profile/password";
    private const string NewPassword = "Mabuhay#Tahi2026";
    private const string ChangedSubject = "Your CSPS password was changed";

    // Stored value of SessionRevocationReason.PasswordChanged; 6 and 7 are already taken.
    private const SessionRevocationReason PasswordChangedReason = (SessionRevocationReason)8;

    [Fact]
    public async Task ChangingMyPasswordKeepsThisDeviceAndSignsOutTheOthers()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var clientA = AuthClient.CreateClient(factory);
        using var clientB = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var deviceA = await AuthClient.SignInFullyAsync(clientA, staff, signInsSoFar: 0);
        var deviceB = await AuthClient.SignInFullyAsync(clientB, staff, signInsSoFar: 1);

        using var response = await ChangeAsync(clientA, deviceA.AccessToken, staff.Password, NewPassword);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await AuthClient.SiteSettingsStatusAsync(clientA, deviceA.AccessToken)).ShouldBe(HttpStatusCode.OK);
        (await AuthClient.SiteSettingsStatusAsync(clientA, deviceB.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);
        using var refreshB = await AuthClient.RefreshAsync(clientB);
        refreshB.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        using var refreshA = await AuthClient.RefreshAsync(clientA);
        refreshA.StatusCode.ShouldBe(HttpStatusCode.OK);

        await using var context = database.CreateContext();
        var sessions = await context.UserSessions.AsNoTracking().Where(s => s.UserId == staff.Id).ToListAsync(TestContext.Current.CancellationToken);
        sessions.Single(s => s.Id == deviceA.SessionId).RevokedAt.ShouldBeNull();
        sessions.Single(s => s.Id == deviceB.SessionId).RevokedReason.ShouldBe(PasswordChangedReason);
    }

    [Fact]
    public async Task TheNewPasswordSignsInAndTheOldOneDoesNot()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        using var change = await ChangeAsync(client, device.AccessToken, staff.Password, NewPassword);
        change.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var fresh = AuthClient.CreateClient(factory);
        using var withNew = await AuthClient.SignInAsync(fresh, staff.Email, NewPassword);
        using var withOld = await AuthClient.SignInAsync(fresh, staff.Email, staff.Password);

        withNew.StatusCode.ShouldBe(HttpStatusCode.OK);
        withOld.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task OneNoticeEmailIsQueued()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        using var change = await ChangeAsync(client, device.AccessToken, staff.Password, NewPassword);

        change.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var mails = await AuthClient.WaitForEmailsAsync(client, staff.Email, count: 2);
        mails.Count(static mail => mail.Subject == ChangedSubject).ShouldBe(1);
    }

    [Fact]
    public async Task TheChangeAndTheRevocationAreAuditedWithFixedWordsOnly()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var clientA = AuthClient.CreateClient(factory);
        using var clientB = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var deviceA = await AuthClient.SignInFullyAsync(clientA, staff, signInsSoFar: 0);
        await AuthClient.SignInFullyAsync(clientB, staff, signInsSoFar: 1);

        using var change = await ChangeAsync(clientA, deviceA.AccessToken, staff.Password, NewPassword);

        change.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        var key = staff.Id.ToString("D");
        var entries = await context.AuditLog.AsNoTracking()
            .Where(entry => entry.TargetId == key && (entry.Action == AuditActions.PasswordChanged || entry.Action == AuditActions.SessionsRevoked))
            .ToListAsync(TestContext.Current.CancellationToken);
        var changed = entries.Single(static entry => entry.Action == AuditActions.PasswordChanged);
        changed.TargetType.ShouldBe("User");
        changed.Detail.ShouldBe("profile");
        changed.ActorUserId.ShouldBe(staff.Id);
        var revoked = entries.Single(static entry => entry.Action == AuditActions.SessionsRevoked);
        revoked.TargetType.ShouldBe("User");
        revoked.Detail.ShouldBe("password-changed");
        foreach (var entry in entries)
        {
            var detail = entry.Detail.ShouldNotBeNull();
            detail.ShouldNotContain(staff.Password);
            detail.ShouldNotContain(NewPassword);
        }
    }

    [Fact]
    public async Task ARequestWithoutAnIdempotencyKeyIsRefusedAndChangesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        using var response = await ChangeAsync(client, device.AccessToken, staff.Password, NewPassword, idempotencyKey: false);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        problem.GetProperty("code").GetString().ShouldBe("idempotency.key-missing");
        using var fresh = AuthClient.CreateClient(factory);
        using var oldStillWorks = await AuthClient.SignInAsync(fresh, staff.Email, staff.Password);
        oldStillWorks.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AnAnonymousCallerIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var response = await ChangeAsync(client, null, "whatever1!", NewPassword);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ChangingMyPasswordNeverTouchesAnotherAccount()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var mine = AuthClient.CreateClient(factory);
        using var theirs = AuthClient.CreateClient(factory);
        var me = await AuthClient.CreateStaffAsync(factory);
        var someoneElse = await AuthClient.CreateStaffAsync(factory);
        var myDevice = await AuthClient.SignInFullyAsync(mine, me);
        var theirDevice = await AuthClient.SignInFullyAsync(theirs, someoneElse);

        using var change = await ChangeAsync(mine, myDevice.AccessToken, me.Password, NewPassword);

        change.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await AuthClient.SiteSettingsStatusAsync(theirs, theirDevice.AccessToken)).ShouldBe(HttpStatusCode.OK);
        using var fresh = AuthClient.CreateClient(factory);
        using var theirSignIn = await AuthClient.SignInAsync(fresh, someoneElse.Email, someoneElse.Password);
        theirSignIn.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    private static async Task<HttpResponseMessage> ChangeAsync(
        HttpClient client, string? accessToken, string? currentPassword, string? newPassword, bool idempotencyKey = true)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, Route, accessToken);
        request.Content = JsonContent.Create(new { currentPassword, newPassword });
        if (idempotencyKey)
        {
            request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
