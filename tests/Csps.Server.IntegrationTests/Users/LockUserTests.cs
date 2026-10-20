using System.Net;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Users;

/// <summary>
/// USER-03, USER-05, D-16, D-17, D-21, D-40: a Manager locks and unlocks staff. A lock signs the person out at once, has no timer, is
/// not lifted by a password reset, and is separate from the 15-minute failed-password lockout, which unlock never touches.
/// </summary>
public sealed class LockUserTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string LinkInvalidCode = "auth.link-invalid";

    [Fact]
    public async Task ALockedColleagueIsSignedOutAtOnceCannotSignInOrResetTheirWayBackAndIsBackOnlyAfterUnlock()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var managerClient = AuthClient.CreateClient(factory);
        using var colleagueClient = AuthClient.CreateClient(factory);
        using var mailbox = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var device = await AuthClient.SignInFullyAsync(colleagueClient, staff);
        (await AuthClient.SiteSettingsStatusAsync(colleagueClient, device.AccessToken)).ShouldBe(HttpStatusCode.OK);
        var linkBeforeLock = await AuthClient.RequestResetTokenAsync(mailbox, staff.Email, emailsSoFar: 1);

        using (var locked = await UserFixtures.ActionAsync(managerClient, manager.AccessToken, staff.Id, "lock"))
        {
            locked.StatusCode.ShouldBe(HttpStatusCode.NoContent, await locked.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        // The very next request with the old token, and a refresh, are both refused.
        (await AuthClient.SiteSettingsStatusAsync(colleagueClient, device.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);
        using (var refresh = await AuthClient.RefreshAsync(colleagueClient))
        {
            refresh.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        }

        // Signing in answers the one generic 401 (04 D-02).
        using (var freshClient = AuthClient.CreateClient(factory))
        using (var signIn = await AuthClient.SignInAsync(freshClient, staff.Email, staff.Password))
        {
            signIn.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        }

        // D-17: forgot-password is the neutral 202 and sends nothing; a link issued before the lock no longer works.
        var emailsBefore = (await AuthClient.ReadEmailsAsync(mailbox, staff.Email)).Count;
        using (var forgot = await AuthClient.ForgotPasswordAsync(mailbox, staff.Email))
        {
            forgot.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        }

        (await AuthClient.ReadEmailsAsync(mailbox, staff.Email)).Count.ShouldBe(emailsBefore);
        using (var check = await AuthClient.CheckResetLinkAsync(mailbox, linkBeforeLock))
        using (var reset = await AuthClient.ResetPasswordAsync(mailbox, linkBeforeLock, "Brand-New-Pass-7731"))
        {
            await AssertInvalidLinkAsync(check);
            await AssertInvalidLinkAsync(reset);
        }

        using (var stillBlocked = await AuthClient.SignInAsync(mailbox, staff.Email, "Brand-New-Pass-7731"))
        {
            stillBlocked.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        }

        (await UserFixtures.ReadPageAsync(managerClient, manager.AccessToken, $"q={Uri.EscapeDataString(staff.Email)}")).Items.ShouldHaveSingleItem().Status.ShouldBe("locked");
        (await ManagerLockedAsync(staff.Id)).ShouldBeTrue();

        using (var unlocked = await UserFixtures.ActionAsync(managerClient, manager.AccessToken, staff.Id, "unlock"))
        {
            unlocked.StatusCode.ShouldBe(HttpStatusCode.NoContent, await unlocked.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        (await UserFixtures.ReadPageAsync(managerClient, manager.AccessToken, $"q={Uri.EscapeDataString(staff.Email)}")).Items.ShouldHaveSingleItem().Status.ShouldBe("active");
        var mailsSoFar = (await AuthClient.ReadEmailsAsync(mailbox, staff.Email)).Count;
        using var backClient = AuthClient.CreateClient(factory);
        using var back = await AuthClient.SignInThroughCodeAsync(backClient, staff, signInsSoFar: mailsSoFar);
        back.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AManagerLockHasNoTimerAndStaysAfterThirtyDays()
    {
        var clock = new SteppedClock();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var managerClient = AuthClient.CreateClient(factory);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(baseFactory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);

        using (var locked = await UserFixtures.ActionAsync(managerClient, manager.AccessToken, staff.Id, "lock"))
        {
            locked.StatusCode.ShouldBe(HttpStatusCode.NoContent, await locked.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        clock.Advance(TimeSpan.FromDays(30));

        (await ManagerLockedAsync(staff.Id)).ShouldBeTrue();
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        signIn.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UnlockLeavesTheFifteenMinuteFailedPasswordLockoutInPlace()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var managerClient = AuthClient.CreateClient(factory);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        await AuthClient.LockAsync(factory, staff.Id);

        using (var locked = await UserFixtures.ActionAsync(managerClient, manager.AccessToken, staff.Id, "lock"))
        {
            locked.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using (var unlocked = await UserFixtures.ActionAsync(managerClient, manager.AccessToken, staff.Id, "unlock"))
        {
            unlocked.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        (await ManagerLockedAsync(staff.Id)).ShouldBeFalse();
        await using (var context = database.CreateContext())
        {
            var user = await context.Users.AsNoTracking().SingleAsync(candidate => candidate.Id == staff.Id, TestContext.Current.CancellationToken);
            user.LockoutEnd.ShouldNotBeNull();
            user.LockoutEnd.Value.ShouldBeGreaterThan(TimeProvider.System.GetUtcNow());
        }

        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        signIn.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task LockingAnAlreadyLockedAccountOrUnlockingAnUnlockedOneAnswers204AndChangesAndRecordsNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Lia", "Lockrepeat", Roles.Admin);

        using (var unlockedAlready = await UserFixtures.ActionAsync(client, manager.AccessToken, person.Id, "unlock"))
        {
            unlockedAlready.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        (await CountAuditAsync(person.Id, "user.unlocked")).ShouldBe(0);
        var untouched = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);
        using (var first = await UserFixtures.ActionAsync(client, manager.AccessToken, person.Id, "lock"))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var afterFirst = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);
        afterFirst.GetProperty("version").GetGuid().ShouldNotBe(untouched.GetProperty("version").GetGuid());
        using (var second = await UserFixtures.ActionAsync(client, manager.AccessToken, person.Id, "lock"))
        {
            second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        (await CountAuditAsync(person.Id, "user.locked")).ShouldBe(1);
        (await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id)).GetProperty("version").GetGuid()
            .ShouldBe(afterFirst.GetProperty("version").GetGuid());
    }

    [Fact]
    public async Task LockAndUnlockRotateTheEditVersionAndStampTheManagerAsTheLastChanger()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Ned", "Version", Roles.Admin);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);

        using (var locked = await UserFixtures.ActionAsync(client, manager.AccessToken, person.Id, "lock"))
        {
            locked.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var afterLock = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);
        afterLock.GetProperty("version").GetGuid().ShouldNotBe(before.GetProperty("version").GetGuid());
        afterLock.GetProperty("status").GetString().ShouldBe("locked");
        afterLock.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);

        using (var unlocked = await UserFixtures.ActionAsync(client, manager.AccessToken, person.Id, "unlock"))
        {
            unlocked.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var afterUnlock = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);
        afterUnlock.GetProperty("version").GetGuid().ShouldNotBe(afterLock.GetProperty("version").GetGuid());
        afterUnlock.GetProperty("status").GetString().ShouldBe("active");
    }

    [Fact]
    public async Task LockAndUnlockAreAuditedAgainstTheUserWithNoDetailAndTheRevocationIsRecordedOnce()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var managerClient = AuthClient.CreateClient(factory);
        using var colleagueClient = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        await AuthClient.SignInFullyAsync(colleagueClient, staff);

        (await UserFixtures.ActionAsync(managerClient, manager.AccessToken, staff.Id, "lock")).Dispose();
        (await UserFixtures.ActionAsync(managerClient, manager.AccessToken, staff.Id, "unlock")).Dispose();

        await using var context = database.CreateContext();
        var key = staff.Id.ToString("D");
        var entries = await context.AuditLog.AsNoTracking()
            .Where(entry => entry.TargetId == key && (entry.Action.StartsWith("user.") || entry.Action == AuditActions.SessionsRevoked))
            .OrderBy(entry => entry.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
        entries.Select(entry => entry.Action).ShouldBe(
            [AuditActions.SessionsRevoked, "user.locked", "user.unlocked"], ignoreOrder: true);
        entries.ShouldAllBe(entry => entry.ActorUserId == manager.UserId && entry.TargetType == "User");
        entries.Single(entry => entry.Action == AuditActions.SessionsRevoked).Detail.ShouldBe("account-changed");
        entries.Where(entry => entry.Action.StartsWith("user.", StringComparison.Ordinal)).ShouldAllBe(entry => entry.Detail == null);
    }

    [Fact]
    public async Task AnAdminIsRefusedWith403AnAnonymousCallerWith401AndAnUnknownPersonWith404()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Una", "Untouched", Roles.Admin);

        foreach (var action in new[] { "lock", "unlock" })
        {
            using var asAdmin = await UserFixtures.ActionAsync(client, admin.AccessToken, person.Id, action);
            using var anonymous = await UserFixtures.ActionAsync(client, null, person.Id, action);
            using var unknown = await UserFixtures.ActionAsync(client, manager.AccessToken, Guid.NewGuid(), action);

            asAdmin.StatusCode.ShouldBe(HttpStatusCode.Forbidden, action);
            anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized, action);
            unknown.StatusCode.ShouldBe(HttpStatusCode.NotFound, action);
            (await ProblemJson.ReadAsync(unknown, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("users.not-found");
        }

        (await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id)).GetProperty("status").GetString().ShouldBe("active");
    }

    private static async Task AssertInvalidLinkAsync(HttpResponseMessage response)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe(LinkInvalidCode);
    }

    private async Task<bool> ManagerLockedAsync(Guid id)
    {
        await using var context = database.CreateContext();
        var user = await context.Users.AsNoTracking().SingleAsync(candidate => candidate.Id == id, TestContext.Current.CancellationToken);
        return user.ManagerLockedAtUtc is not null;
    }

    private async Task<int> CountAuditAsync(Guid id, string action)
    {
        await using var context = database.CreateContext();
        var key = id.ToString("D");
        return await context.AuditLog.AsNoTracking().CountAsync(entry => entry.TargetId == key && entry.Action == action, TestContext.Current.CancellationToken);
    }
}
