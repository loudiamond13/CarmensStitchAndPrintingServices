using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Users;

/// <summary>
/// C-4, 04 D-21, D-22, D-24, D-14, USER-05, USER-06, D-40, T-05-79, T-05-80: a Manager sets a temporary password for a colleague. The
/// colleague is signed out everywhere at once, a failed-password lockout ends, the "reset by a Manager" notice is emailed, and the next
/// sign-in goes through the emailed code and then forces a new password. The password is never returned, mailed, audited or stored in
/// the idempotency record, and only the basic rule applies.
/// </summary>
public sealed class TemporaryPasswordTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Temporary = "Tela-Sukat-7381";
    private const string ManagerName = "Paolo Reyes";
    private const string SetAction = "user.temporary-password-set";
    private const string RevokedAction = "auth.sessions-revoked";

    [Fact]
    public async Task ATemporaryPasswordSignsThePersonOutEverywhereClearsTheLockoutNotifiesThemAndForcesANewPasswordAtNextSignIn()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var managerClient = AuthClient.CreateClient(factory);
        using var phone = AuthClient.CreateClient(factory);
        using var laptop = AuthClient.CreateClient(factory);
        using var fresh = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var first = await AuthClient.SignInFullyAsync(phone, staff);
        var second = await AuthClient.SignInFullyAsync(laptop, staff, signInsSoFar: 1);
        await AuthClient.LockAsync(factory, staff.Id);
        var before = await UserFixtures.ReadDetailAsync(managerClient, manager.AccessToken, staff.Id);
        (await AuthClient.SiteSettingsStatusAsync(phone, first.AccessToken)).ShouldBe(HttpStatusCode.OK);
        (await AuthClient.SiteSettingsStatusAsync(laptop, second.AccessToken)).ShouldBe(HttpStatusCode.OK);

        using var response = await SetAsync(managerClient, manager.AccessToken, staff.Id, Temporary);

        // The answer is empty: the password is never returned.
        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty();

        // Both devices are signed out on the very next request.
        (await AuthClient.SiteSettingsStatusAsync(phone, first.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);
        (await AuthClient.SiteSettingsStatusAsync(laptop, second.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);

        // The old password is gone, and the temporary one passes the lockout, then the emailed code, then must be replaced.
        using (var old = await AuthClient.SignInAsync(fresh, staff.Email, staff.Password))
        {
            old.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        }

        var signingIn = new TestStaff(staff.Id, staff.Email, Temporary);
        using (var verify = await AuthClient.SignInThroughCodeAsync(fresh, signingIn, signInsSoFar: 3))
        {
            verify.StatusCode.ShouldBe(HttpStatusCode.OK, await verify.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            using var verified = JsonDocument.Parse(await verify.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            verified.RootElement.GetProperty("next").GetString().ShouldBe("set-new-password");
            verified.RootElement.GetProperty("reason").GetString().ShouldBe("temporary");
        }

        using (var saved = await AuthClient.SetNewPasswordAsync(fresh, "Own-Choice-Pass-9254"))
        {
            saved.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        // The notice names the Manager, holds no link and never the password.
        var notice = (await AuthClient.WaitForEmailsAsync(managerClient, staff.Email, count: 4))
            .Single(mail => mail.Subject == "A Manager reset your CSPS password");
        notice.Text.ShouldContain($"{ManagerName} set a temporary password for your account");
        notice.Text.ShouldNotContain("#token=");
        (await AuthClient.ReadEmailsAsync(managerClient, staff.Email))
            .ShouldAllBe(mail => !mail.Text.Contains(Temporary, StringComparison.Ordinal) && !mail.Html.Contains(Temporary, StringComparison.Ordinal));

        // SEC-08, D-21: the account changed, so its version moved and the Manager is the last to change it.
        var after = await UserFixtures.ReadDetailAsync(managerClient, manager.AccessToken, staff.Id);
        after.GetProperty("version").GetGuid().ShouldNotBe(before.GetProperty("version").GetGuid());
        after.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);

        // D-40: fixed words only, the Manager as actor, and no password anywhere.
        var set = (await AuditOfAsync(staff.Id, SetAction)).ShouldHaveSingleItem();
        set.ActorUserId.ShouldBe(manager.UserId);
        set.TargetType.ShouldBe("User");
        set.Detail.ShouldBeNull();
        // The later must-change step records its own revocation; this one is told apart by its detail.
        var revoked = (await AuditOfAsync(staff.Id, RevokedAction)).Where(entry => entry.Detail == "temporary-password").ShouldHaveSingleItem();
        revoked.ActorUserId.ShouldBe(manager.UserId);
        await AssertNothingHoldsThePasswordAsync(staff.Id);
    }

    [Fact]
    public async Task ThePasswordIsNotKeptInTheIdempotencyRecordAndARepeatedKeyAnswersTheStoredResult()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var key = Guid.NewGuid();

        for (var attempt = 0; attempt < 2; attempt++)
        {
            using var response = await SetAsync(client, manager.AccessToken, staff.Id, Temporary, key);
            response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        await using var context = database.CreateContext();
        var record = await context.IdempotencyRecords.AsNoTracking().SingleAsync(item => item.Key == key, TestContext.Current.CancellationToken);
        record.StatusCode.ShouldBe(204);
        record.RequestHash.Length.ShouldBe(32);
        new[] { record.ResponseBody, record.Location, record.Route, record.ResponseContentType }
            .ShouldAllBe(text => string.IsNullOrEmpty(text) || !text.Contains(Temporary, StringComparison.Ordinal));
        (await AuditOfAsync(staff.Id, SetAction)).ShouldHaveSingleItem();
    }

    [Theory]
    [InlineData("Ab1!", "Use at least 8 characters.")]
    [InlineData("Abcdefgh!", "Add at least one number.")]
    [InlineData("Abcdefg1h", "Add at least one symbol, like ! or #.")]
    [InlineData("Abcdef1!\tx", "Remove tabs and line breaks from your password.")]
    [InlineData("", "Enter a temporary password.")]
    [InlineData(null, "Enter a temporary password.")]
    public async Task APasswordThatBreaksTheBasicRuleIs400OnItsFieldAndNothingChanges(string? password, string message)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        using var personClient = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var device = await AuthClient.SignInFullyAsync(personClient, staff);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);

        using var response = await SetAsync(client, manager.AccessToken, staff.Id, password);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("temporaryPassword").EnumerateArray().Select(item => item.GetString()).ShouldBe([message]);
        (await AuthClient.SiteSettingsStatusAsync(personClient, device.AccessToken)).ShouldBe(HttpStatusCode.OK);
        (await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id)).GetProperty("version").GetGuid().ShouldBe(before.GetProperty("version").GetGuid());
        (await AuditOfAsync(staff.Id, SetAction)).ShouldBeEmpty();
    }

    [Fact]
    public async Task ASixtyFiveCharacterPasswordIsRefusedAndOnlyTheBasicRuleApplies()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);

        using (var over = await SetAsync(client, manager.AccessToken, staff.Id, "Aa1!" + new string('x', 61)))
        {
            over.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await ProblemJson.ReadAsync(over, TestContext.Current.CancellationToken)).GetProperty("errors").GetProperty("temporaryPassword")[0].GetString()
                .ShouldBe("Use 64 characters or fewer.");
        }

        // No name, breach or common-password check at this step (04 D-21): a well-known password with a number and a symbol passes.
        using var common = await SetAsync(client, manager.AccessToken, staff.Id, "Password1!");
        common.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task AManagerCannotSetTheirOwnPasswordThisWayAndNothingChanges()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var other = await TestSessions.StartAsync(factory, Roles.Manager);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, manager.UserId);

        using var response = await SetAsync(client, manager.AccessToken, manager.UserId, Temporary);

        await AssertRefusedAsync(response, "users.own-account", "You can't do this to your own account.");
        (await UserFixtures.ReadDetailAsync(client, other.AccessToken, manager.UserId)).GetProperty("version").GetGuid()
            .ShouldBe(before.GetProperty("version").GetGuid());
        (await AuditOfAsync(manager.UserId, SetAction)).ShouldBeEmpty();
    }

    [Theory]
    [InlineData("deactivated")]
    [InlineData("locked")]
    public async Task ADeactivatedOrLockedPersonIsRefusedWith422AndKeepsTheirPassword(string state)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        if (state == "deactivated")
        {
            await AuthClient.DeactivateAsync(factory, staff.Id);
        }
        else
        {
            await AccountStateFixtures.ManagerLockAsync(factory, staff.Id);
        }

        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);

        using var response = await SetAsync(client, manager.AccessToken, staff.Id, Temporary);

        await AssertRefusedAsync(response, "users.blocked", "Unlock or activate this person first.");
        (await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id)).GetProperty("version").GetGuid().ShouldBe(before.GetProperty("version").GetGuid());
        (await AuthClient.ReadEmailsAsync(client, staff.Email)).ShouldBeEmpty();
        (await AuditOfAsync(staff.Id, SetAction)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AnInvitedPersonWhoGetsATemporaryPasswordCanSignInWithItAndTheOldInvitationDies()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        using var personClient = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var invited = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Hal", "Honrado", Roles.Admin, withPassword: false);
        await UserFixtures.AddInvitationAsync(database, invited.Id, expired: false);

        using (var response = await SetAsync(client, manager.AccessToken, invited.Id, Temporary))
        {
            response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        (await IsConfirmedAsync(invited.Id)).ShouldBeFalse();

        using var verify = await AuthClient.SignInThroughCodeAsync(personClient, new TestStaff(invited.Id, invited.Email, Temporary));
        verify.StatusCode.ShouldBe(HttpStatusCode.OK, await verify.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        using (var verified = JsonDocument.Parse(await verify.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)))
        {
            verified.RootElement.GetProperty("next").GetString().ShouldBe("set-new-password");
            verified.RootElement.GetProperty("reason").GetString().ShouldBe("temporary");
        }

        (await IsConfirmedAsync(invited.Id)).ShouldBeTrue();
        var detail = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, invited.Id);
        detail.GetProperty("hasPassword").GetBoolean().ShouldBeTrue();
        detail.GetProperty("inviteState").GetString().ShouldBe("none");
        await using var context = database.CreateContext();
        var invitations = await context.AccountTokens.AsNoTracking()
            .Where(token => token.UserId == invited.Id && token.Purpose == AccountTokenPurpose.Invitation)
            .ToListAsync(TestContext.Current.CancellationToken);
        invitations.ShouldHaveSingleItem().RevokedAt.ShouldNotBeNull();
    }

    [Fact]
    public async Task AResetLinkEmailedBeforeATemporaryPasswordStopsWorkingAndTheMustChangeFlagStays()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var token = await AuthClient.RequestResetTokenAsync(client, staff.Email);

        using (var set = await SetAsync(client, manager.AccessToken, staff.Id, Temporary))
        {
            set.StatusCode.ShouldBe(HttpStatusCode.NoContent, await set.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        using var check = await AuthClient.CheckResetLinkAsync(client, token);
        using var reset = await AuthClient.ResetPasswordAsync(client, token, "Another-Pass-9021");

        await AssertDeadLinkAsync(check);
        await AssertDeadLinkAsync(reset);
        await using var scope = factory.Services.CreateAsyncScope();
        var account = (await scope.ServiceProvider.GetRequiredService<IUserAccounts>().FindByIdAsync(staff.Id, TestContext.Current.CancellationToken)).ShouldNotBeNull();
        account.MustChangePassword.ShouldBe(PasswordChangeReason.Temporary);
    }

    [Fact]
    public async Task AnUnknownOrDeletedPersonAnswers404()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var deleted = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Jun", "Javier", Roles.Admin);
        await AccountStateFixtures.MarkDeletedAsync(factory, deleted.Id);

        foreach (var id in new[] { Guid.NewGuid(), deleted.Id })
        {
            using var response = await SetAsync(client, manager.AccessToken, id, Temporary);

            response.StatusCode.ShouldBe(HttpStatusCode.NotFound, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("users.not-found");
        }
    }

    [Fact]
    public async Task AnAdminIsRefusedWith403AndAnAnonymousCallerWith401AndNothingChanges()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);

        using (var forbidden = await SetAsync(client, admin.AccessToken, staff.Id, Temporary))
        {
            forbidden.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        }

        using (var anonymous = await SetAsync(client, null, staff.Id, Temporary))
        {
            anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        }

        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        signIn.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await AuditOfAsync(staff.Id, SetAction)).ShouldBeEmpty();
    }

    private static async Task<HttpResponseMessage> SetAsync(HttpClient client, string? accessToken, Guid id, string? password, Guid? key = null)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, $"{UserFixtures.Route}/{id:D}/temporary-password", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, (key ?? Guid.NewGuid()).ToString("D"));
        request.Content = JsonContent.Create(new { temporaryPassword = password });
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task AssertRefusedAsync(HttpResponseMessage response, string code, string message)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe(code);
        problem.GetProperty("detail").GetString().ShouldBe(message);
    }

    private static async Task AssertDeadLinkAsync(HttpResponseMessage response)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("auth.link-invalid");
    }

    private async Task<bool> IsConfirmedAsync(Guid id)
    {
        await using var context = database.CreateContext();
        return await context.Users.AsNoTracking().Where(user => user.Id == id).Select(user => user.EmailConfirmed).SingleAsync(TestContext.Current.CancellationToken);
    }

    private async Task<List<AuditEntry>> AuditOfAsync(Guid userId, string action)
    {
        await using var context = database.CreateContext();
        var key = userId.ToString("D");
        return await context.AuditLog.AsNoTracking()
            .Where(entry => entry.TargetId == key && entry.Action == action)
            .OrderBy(entry => entry.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    // T-05-80: no audit detail for the person holds the password.
    private async Task AssertNothingHoldsThePasswordAsync(Guid userId)
    {
        await using var context = database.CreateContext();
        var key = userId.ToString("D");
        var details = await context.AuditLog.AsNoTracking()
            .Where(entry => entry.TargetId == key)
            .Select(entry => entry.Detail)
            .ToListAsync(TestContext.Current.CancellationToken);
        details.OfType<string>().ShouldAllBe(detail => !detail.Contains(Temporary, StringComparison.Ordinal));
    }
}
