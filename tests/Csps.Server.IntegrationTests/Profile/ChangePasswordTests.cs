using System.Net;
using System.Net.Http.Json;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

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
    public async Task AResetLinkEmailedBeforeThePasswordChangeStopsWorkingAndThisDeviceStaysSignedIn()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        using var mailbox = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var token = await AuthClient.RequestResetTokenAsync(mailbox, staff.Email, emailsSoFar: 1);

        using (var change = await ChangeAsync(client, device.AccessToken, staff.Password, NewPassword))
        {
            change.StatusCode.ShouldBe(HttpStatusCode.NoContent, await change.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        using var check = await AuthClient.CheckResetLinkAsync(mailbox, token);
        using var reset = await AuthClient.ResetPasswordAsync(mailbox, token, "Another-Pass-9021");

        foreach (var response in new[] { check, reset })
        {
            response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
            (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("auth.link-invalid");
        }

        (await AuthClient.SiteSettingsStatusAsync(client, device.AccessToken)).ShouldBe(HttpStatusCode.OK);
        using var refresh = await AuthClient.RefreshAsync(client);
        refresh.StatusCode.ShouldBe(HttpStatusCode.OK);
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

    [Fact]
    public async Task AWrongCurrentPasswordIsAFieldErrorAndChangesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var clientA = AuthClient.CreateClient(factory);
        using var clientB = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var deviceA = await AuthClient.SignInFullyAsync(clientA, staff, signInsSoFar: 0);
        var deviceB = await AuthClient.SignInFullyAsync(clientB, staff, signInsSoFar: 1);

        using var response = await ChangeAsync(clientA, deviceA.AccessToken, "Not-My-Password1!", NewPassword);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        problem.GetProperty("errors").GetProperty("currentPassword").EnumerateArray().Select(static m => m.GetString()).ShouldBe(["Your current password is incorrect."]);
        (await AuthClient.SiteSettingsStatusAsync(clientA, deviceB.AccessToken)).ShouldBe(HttpStatusCode.OK);
        (await StoredPasswordIsAsync(factory, staff.Id, staff.Password)).ShouldBeTrue();
    }

    [Fact]
    public async Task FiveWrongCurrentPasswordsLockTheAccountLikeSignInDoes()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        for (var attempt = 1; attempt <= 4; attempt++)
        {
            using var wrong = await ChangeAsync(client, device.AccessToken, "Not-My-Password1!", NewPassword);
            wrong.StatusCode.ShouldBe(HttpStatusCode.BadRequest, $"attempt {attempt}");
        }

        using var fifth = await ChangeAsync(client, device.AccessToken, "Not-My-Password1!", NewPassword);
        var problem = await ProblemJson.ReadAsync(fifth, TestContext.Current.CancellationToken);

        fifth.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        problem.GetProperty("code").GetString().ShouldBe("profile.password-locked");
        problem.GetProperty("detail").GetString().ShouldBe("Too many wrong passwords. Try again in 15 minutes.");
        var wait = int.Parse(fifth.Headers.GetValues("Retry-After").Single(), System.Globalization.CultureInfo.InvariantCulture);
        wait.ShouldBeInRange(890, 900);

        using var lockedRight = await ChangeAsync(client, device.AccessToken, staff.Password, NewPassword);
        lockedRight.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        (await ProblemJson.ReadAsync(lockedRight, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("profile.password-locked");

        using var fresh = AuthClient.CreateClient(factory);
        using var signIn = await AuthClient.SignInAsync(fresh, staff.Email, staff.Password);
        signIn.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await StoredPasswordIsAsync(factory, staff.Id, staff.Password)).ShouldBeTrue();
    }

    [Fact]
    public async Task TheLockoutSendsOneEmailAndWritesOneAuditEntry()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        for (var attempt = 1; attempt <= 5; attempt++)
        {
            using var wrong = await ChangeAsync(client, device.AccessToken, "Not-My-Password1!", NewPassword);
            wrong.StatusCode.ShouldBe(attempt < 5 ? HttpStatusCode.BadRequest : HttpStatusCode.TooManyRequests);
        }

        var mails = await AuthClient.WaitForEmailsAsync(client, staff.Email, count: 2);
        mails.Count(static mail => mail.Subject.StartsWith("Your CSPS account is locked", StringComparison.Ordinal)).ShouldBe(1);
        await using var context = database.CreateContext();
        var key = staff.Id.ToString("D");
        var lockout = await context.AuditLog.AsNoTracking().SingleAsync(
            entry => entry.TargetId == key && entry.Action == AuditActions.Lockout, TestContext.Current.CancellationToken);
        lockout.Detail.ShouldBe("password");
        lockout.TargetType.ShouldBe("User");
    }

    [Fact]
    public async Task TheCorrectCurrentPasswordResetsTheWrongCount()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        for (var attempt = 1; attempt <= 4; attempt++)
        {
            using var wrong = await ChangeAsync(client, device.AccessToken, "Not-My-Password1!", NewPassword);
            wrong.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        }

        using var right = await ChangeAsync(client, device.AccessToken, staff.Password, NewPassword);
        using var wrongAgain = await ChangeAsync(client, device.AccessToken, "Not-My-Password1!", "Another#Tahi2027");

        right.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        wrongAgain.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Theory]
    [InlineData("short1!", "Use at least 8 characters.")]
    [InlineData("Paolo#2026x", "Don't use your name or email in your password.")]
    [InlineData("Pwned#Pass2026", "This password has appeared in a data breach. Choose a different one.")]
    public async Task ARefusedNewPasswordIsAFieldErrorOnNewPasswordAndChangesNothing(string password, string message)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var clientA = AuthClient.CreateClient(factory);
        using var clientB = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var deviceA = await AuthClient.SignInFullyAsync(clientA, staff, signInsSoFar: 0);
        var deviceB = await AuthClient.SignInFullyAsync(clientB, staff, signInsSoFar: 1);

        using var response = await ChangeAsync(clientA, deviceA.AccessToken, staff.Password, password);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        problem.GetProperty("errors").GetProperty("newPassword").EnumerateArray().Select(static m => m.GetString()).ShouldBe([message]);
        (await AuthClient.SiteSettingsStatusAsync(clientA, deviceB.AccessToken)).ShouldBe(HttpStatusCode.OK);
        (await StoredPasswordIsAsync(factory, staff.Id, staff.Password)).ShouldBeTrue();
    }

    [Fact]
    public async Task TheCurrentPasswordAsTheNewOneIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        using var response = await ChangeAsync(client, device.AccessToken, staff.Password, staff.Password);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        problem.GetProperty("errors").GetProperty("newPassword").EnumerateArray().Select(static m => m.GetString()).ShouldBe(["Choose a different password from your current one."]);
    }

    [Fact]
    public async Task WhenTheBreachServiceIsDownAnUncommonPasswordIsAcceptedAndMarkedForARecheck()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        using var response = await ChangeAsync(client, device.AccessToken, staff.Password, "Hibp-Down#2026");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        (await context.Users.AsNoTracking().SingleAsync(user => user.Id == staff.Id, TestContext.Current.CancellationToken)).BreachRecheckPending.ShouldBeTrue();
        var key = staff.Id.ToString("D");
        (await context.AuditLog.AsNoTracking().CountAsync(
            entry => entry.TargetId == key && entry.Action == AuditActions.BreachCheckUnavailable, TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    private static async Task<bool> StoredPasswordIsAsync(WebApplicationFactory<Program> factory, Guid userId, string password)
    {
        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
            return await accounts.CheckPasswordAsync(userId, password, TestContext.Current.CancellationToken) == PasswordCheck.Succeeded;
        }
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
