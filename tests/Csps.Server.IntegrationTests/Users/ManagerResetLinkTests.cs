using System.Net;
using Csps.Application.Email;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Users;

/// <summary>
/// USER-07, USER-06, D-21, D-39, D-40, D-41 Q5, T-05-77, T-05-78: a Manager emails a colleague a reset link the colleague opens
/// themself. The link names the Manager, lasts 30 minutes, works once and replaces any earlier one; the hourly cap is shared with
/// forgot-password; a locked, deactivated or not-yet-set-up person gets none; and the Manager never sees the link.
/// </summary>
public sealed class ManagerResetLinkTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string ManagerName = "Paolo Reyes";
    private const string ResetSubject = "Reset your CSPS password";
    private const string SentAction = "user.reset-link-sent";
    private const string LinkStart = "https://localhost/admin/reset-password#token=";
    private const string Action = "send-reset-link";
    private const string Temporary = "Tela-Sukat-7381";

    [Fact]
    public async Task ASentLinkNamesTheManagerWorksOnceForThirtyMinutesEndsTheSessionsAndIsNeverShownToTheManager()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var managerClient = AuthClient.CreateClient(factory);
        using var personClient = AuthClient.CreateClient(factory);
        using var mailbox = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var device = await AuthClient.SignInFullyAsync(personClient, staff);
        var before = await UserFixtures.ReadDetailAsync(managerClient, manager.AccessToken, staff.Id);

        using var response = await UserFixtures.ActionAsync(managerClient, manager.AccessToken, staff.Id, Action);

        // T-05-77: the answer is empty, so the Manager has no way to see the link.
        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty();

        var mail = (await AuthClient.WaitForEmailsAsync(mailbox, staff.Email, count: 2)).Single(item => item.Subject == ResetSubject);
        mail.Text.ShouldContain($"{ManagerName} sent you this link to set a new password for {staff.Email}.");
        mail.Text.ShouldContain("This link works for 30 minutes and only once.");
        mail.Text.ShouldContain($"Didn't expect this? Ask {ManagerName} or another Manager.");
        mail.Text.ShouldContain(LinkStart);
        mail.Text.ShouldNotContain("Requested ");
        var token = AuthClient.TokenOf(mail);
        token.Length.ShouldBe(43);

        await using (var context = database.CreateContext())
        {
            var row = await context.AccountTokens.AsNoTracking()
                .SingleAsync(item => item.UserId == staff.Id && item.Purpose == AccountTokenPurpose.PasswordReset, TestContext.Current.CancellationToken);
            row.TokenHash.ShouldBe(TokenHash.Compute(token));
            row.ExpiresAt.ShouldBe(row.CreatedAt.AddMinutes(30));
        }

        // D-21: the account itself is unchanged, so its version stays.
        var after = await UserFixtures.ReadDetailAsync(managerClient, manager.AccessToken, staff.Id);
        after.GetProperty("version").GetGuid().ShouldBe(before.GetProperty("version").GetGuid());

        // D-40: the entry names the person by id, the Manager as actor, and has no detail.
        var entry = (await AuditOfAsync(staff.Id)).ShouldHaveSingleItem();
        entry.ActorUserId.ShouldBe(manager.UserId);
        entry.TargetType.ShouldBe("User");
        entry.Detail.ShouldBeNull();

        // The person opens it themself: it works once and, as any reset does, ends their sessions (Phase 4 rule).
        (await AuthClient.SiteSettingsStatusAsync(personClient, device.AccessToken)).ShouldBe(HttpStatusCode.OK);
        using (var reset = await AuthClient.ResetPasswordAsync(mailbox, token, "Fresh-Start-Pass-4471"))
        {
            reset.StatusCode.ShouldBe(HttpStatusCode.NoContent, await reset.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        (await AuthClient.SiteSettingsStatusAsync(personClient, device.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);
        using (var again = await AuthClient.CheckResetLinkAsync(mailbox, token))
        {
            again.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        }
    }

    [Fact]
    public async Task ASecondSendReplacesTheFirstLink()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);

        using (var first = await UserFixtures.ActionAsync(client, manager.AccessToken, staff.Id, Action))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var firstToken = AuthClient.TokenOf((await AuthClient.WaitForEmailsAsync(client, staff.Email)).Single());
        using (var second = await UserFixtures.ActionAsync(client, manager.AccessToken, staff.Id, Action))
        {
            second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var secondToken = AuthClient.TokenOf((await AuthClient.WaitForEmailsAsync(client, staff.Email, count: 2))[1]);

        secondToken.ShouldNotBe(firstToken);
        using (var old = await AuthClient.CheckResetLinkAsync(client, firstToken))
        {
            old.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        }

        using (var fresh = await AuthClient.CheckResetLinkAsync(client, secondToken))
        {
            fresh.StatusCode.ShouldBe(HttpStatusCode.OK);
        }
    }

    [Fact]
    public async Task ManagerSendsCountTowardTheSameHourlyCapAsForgotPasswordAndTheFourthIs429()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);

        // Two the person asked for, then one from the Manager makes three in the hour.
        for (var request = 0; request < 2; request++)
        {
            using var forgot = await AuthClient.ForgotPasswordAsync(client, staff.Email);
            forgot.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        }

        using (var third = await UserFixtures.ActionAsync(client, manager.AccessToken, staff.Id, Action))
        {
            third.StatusCode.ShouldBe(HttpStatusCode.NoContent, await third.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        using (var capped = await UserFixtures.ActionAsync(client, manager.AccessToken, staff.Id, Action))
        {
            capped.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests, await capped.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            var problem = await ProblemJson.ReadAsync(capped, TestContext.Current.CancellationToken);
            problem.GetProperty("code").GetString().ShouldBe("users.reset-link-capped");
            problem.GetProperty("detail").GetString().ShouldBe("Too many reset emails went to this person in the last hour. Try again later.");
        }

        (await AuthClient.WaitForEmailsAsync(client, staff.Email, count: 3)).Count.ShouldBe(3);
        (await AuditOfAsync(staff.Id)).ShouldHaveSingleItem();
    }

    [Fact]
    public async Task ThreeManagerSendsUseUpTheHourSoForgotPasswordSendsNothingMore()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);

        for (var send = 0; send < 3; send++)
        {
            using var response = await UserFixtures.ActionAsync(client, manager.AccessToken, staff.Id, Action);
            response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        using var forgot = await AuthClient.ForgotPasswordAsync(client, staff.Email);

        // The answer is the same 202 for every address, and the audit trail says the request was capped.
        forgot.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        await using var context = database.CreateContext();
        var key = staff.Id.ToString("D");
        var requests = await context.AuditLog.AsNoTracking()
            .Where(entry => entry.TargetId == key && entry.Action == AuditActions.PasswordResetRequested)
            .ToListAsync(TestContext.Current.CancellationToken);
        requests.ShouldHaveSingleItem().Detail.ShouldBe("capped");
    }

    [Theory]
    [InlineData("deactivated")]
    [InlineData("locked")]
    public async Task ADeactivatedOrLockedPersonGetsNoLinkAndTheAnswerIs422(string state)
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

        using var response = await UserFixtures.ActionAsync(client, manager.AccessToken, staff.Id, Action);

        await AssertRefusedAsync(response, "users.blocked", "Unlock or activate this person first.");
        (await AuthClient.ReadEmailsAsync(client, staff.Email)).ShouldBeEmpty();
        (await AuditOfAsync(staff.Id)).ShouldBeEmpty();
        await using var context = database.CreateContext();
        (await context.AccountTokens.AsNoTracking().AnyAsync(item => item.UserId == staff.Id, TestContext.Current.CancellationToken)).ShouldBeFalse();
    }

    [Fact]
    public async Task AnInvitedPersonWithNoPasswordIsPointedToTheInvitationInstead()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var invited = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Hal", "Honrado", Roles.Admin, withPassword: false);

        using var response = await UserFixtures.ActionAsync(client, manager.AccessToken, invited.Id, Action);

        await AssertRefusedAsync(response, "users.no-password", "This person hasn't set a password yet. Resend the invitation instead.");
        (await AuthClient.ReadEmailsAsync(client, invited.Email)).ShouldBeEmpty();
        (await AuditOfAsync(invited.Id)).ShouldBeEmpty();
    }

    [Fact]
    public async Task BeforeTheFirstCorrectCodeATemporaryPasswordPersonGetsNoLinkWithTheUsualAnswerAndAfterItOne()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var email = $"unproved.{Guid.NewGuid():N}@example.com";
        var id = await UserFixtures.CreateWithTemporaryPasswordAsync(client, manager.AccessToken, email, Temporary);

        using (var refused = await UserFixtures.ActionAsync(client, manager.AccessToken, id, Action))
        {
            refused.StatusCode.ShouldBe(HttpStatusCode.NoContent, await refused.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            (await refused.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty();
        }

        await AssertNothingSentAsync(id, email);

        using (var verify = await AuthClient.SignInThroughCodeAsync(client, new TestStaff(id, email, Temporary)))
        {
            verify.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        using (var sent = await UserFixtures.ActionAsync(client, manager.AccessToken, id, Action))
        {
            sent.StatusCode.ShouldBe(HttpStatusCode.NoContent, await sent.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        await using var context = database.CreateContext();
        (await context.AccountTokens.AsNoTracking().CountAsync(item => item.UserId == id && item.Purpose == AccountTokenPurpose.PasswordReset, TestContext.Current.CancellationToken))
            .ShouldBe(1);
        (await context.EmailOutbox.AsNoTracking().CountAsync(item => item.ToAddress == email && item.Kind == AuthEmailKind.ManagerResetLink, TestContext.Current.CancellationToken))
            .ShouldBe(1);
        (await AuditOfAsync(id)).ShouldHaveSingleItem();
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
            using var response = await UserFixtures.ActionAsync(client, manager.AccessToken, id, Action);

            response.StatusCode.ShouldBe(HttpStatusCode.NotFound, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("users.not-found");
        }

        (await AuthClient.ReadEmailsAsync(client, deleted.Email)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AnAdminIsRefusedWith403AndAnAnonymousCallerWith401AndNothingIsSent()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);

        using (var forbidden = await UserFixtures.ActionAsync(client, admin.AccessToken, staff.Id, Action))
        {
            forbidden.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        }

        using (var anonymous = await UserFixtures.ActionAsync(client, null, staff.Id, Action))
        {
            anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        }

        (await AuthClient.ReadEmailsAsync(client, staff.Email)).ShouldBeEmpty();
    }

    private static async Task AssertRefusedAsync(HttpResponseMessage response, string code, string message)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe(code);
        problem.GetProperty("detail").GetString().ShouldBe(message);
    }

    private async Task AssertNothingSentAsync(Guid id, string email)
    {
        await using var context = database.CreateContext();
        (await context.EmailOutbox.AsNoTracking().CountAsync(item => item.ToAddress == email, TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.AccountTokens.AsNoTracking().CountAsync(item => item.UserId == id && item.Purpose == AccountTokenPurpose.PasswordReset, TestContext.Current.CancellationToken))
            .ShouldBe(0);
        (await AuditOfAsync(id)).ShouldBeEmpty();
    }

    private async Task<List<AuditEntry>> AuditOfAsync(Guid userId)
    {
        await using var context = database.CreateContext();
        var key = userId.ToString("D");
        return await context.AuditLog.AsNoTracking()
            .Where(entry => entry.TargetId == key && entry.Action == SentAction)
            .OrderBy(entry => entry.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
    }
}
