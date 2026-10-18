using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Users;

/// <summary>
/// USER-07, USER-06, D-13, D-21, D-40, T-05-77: a Manager sends a person who has not set a password a fresh 7-day invitation. The old
/// link stops working, the new one names the Manager, nobody who is blocked or already set up gets one, the Manager never sees the link,
/// and the action takes no version and changes nothing about the account itself.
/// </summary>
public sealed class ResendInvitationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string ManagerName = "Paolo Reyes";
    private const string InviteSubject = "Set up your CSPS staff account";
    private const string ResentAction = "user.invitation-resent";
    private const string Action = "resend-invitation";

    [Fact]
    public async Task AResentInvitationKillsTheOldLinkAndTheNewOneNamesTheManagerWorksForSevenDaysAndLeavesTheAccountAlone()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var email = AuthClient.NewEmail();
        var id = await InviteAsync(client, manager.AccessToken, email);
        var oldToken = AuthClient.TokenOf((await AuthClient.WaitForEmailsAsync(client, email)).Single());
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, id);

        using var response = await UserFixtures.ActionAsync(client, manager.AccessToken, id, Action);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty();

        var mails = await AuthClient.WaitForEmailsAsync(client, email, count: 2);
        mails.Count.ShouldBe(2);
        var fresh = mails[1];
        fresh.Subject.ShouldBe(InviteSubject);
        fresh.Text.ShouldContain($"{ManagerName} set up your account.");
        fresh.Text.ShouldContain("This link works for 7 days and only once.");
        var newToken = AuthClient.TokenOf(fresh);
        newToken.ShouldNotBe(oldToken);

        using (var oldLink = await AuthClient.CheckInviteAsync(client, oldToken))
        {
            oldLink.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        }

        using (var newLink = await AuthClient.CheckInviteAsync(client, newToken))
        {
            newLink.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        // The link is stored as a hash that lasts exactly 7 days; the first one is revoked.
        await using (var context = database.CreateContext())
        {
            var tokens = await context.AccountTokens.AsNoTracking()
                .Where(token => token.UserId == id && token.Purpose == AccountTokenPurpose.Invitation)
                .OrderBy(token => token.CreatedAt)
                .ToListAsync(TestContext.Current.CancellationToken);
            tokens.Count.ShouldBe(2);
            tokens[0].RevokedAt.ShouldNotBeNull();
            tokens[1].RevokedAt.ShouldBeNull();
            tokens[1].ExpiresAt.ShouldBe(tokens[1].CreatedAt.AddDays(7));
            tokens[1].TokenHash.ShouldBe(TokenHash.Compute(newToken));
        }

        // D-21: no version is sent and the account is not changed, so its version stays.
        var after = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        after.GetProperty("version").GetGuid().ShouldBe(before.GetProperty("version").GetGuid());
        after.GetProperty("inviteState").GetString().ShouldBe("pending");

        // D-40: the entry names the person by id, the Manager as actor, and has no detail.
        var entry = (await AuditOfAsync(id)).ShouldHaveSingleItem();
        entry.ActorUserId.ShouldBe(manager.UserId);
        entry.TargetType.ShouldBe("User");
        entry.Detail.ShouldBeNull();

        // The new link works: the person sets a password with it.
        using var accepted = await AuthClient.AcceptInviteAsync(client, newToken, "Fresh-Start-Pass-4471");
        accepted.StatusCode.ShouldBe(HttpStatusCode.NoContent, await accepted.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task AnExpiredInvitationIsReplacedByAWorkingOne()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var invited = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Ivo", "Ilagan", Roles.Admin, withPassword: false);
        await UserFixtures.AddInvitationAsync(database, invited.Id, expired: true);

        using var response = await UserFixtures.ActionAsync(client, manager.AccessToken, invited.Id, Action);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var mail = (await AuthClient.WaitForEmailsAsync(client, invited.Email)).ShouldHaveSingleItem();
        using var link = await AuthClient.CheckInviteAsync(client, AuthClient.TokenOf(mail));
        link.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await UserFixtures.ReadDetailAsync(client, manager.AccessToken, invited.Id)).GetProperty("inviteState").GetString().ShouldBe("pending");
    }

    [Fact]
    public async Task APersonWhoHasAPasswordIsRefusedWith422AndGetsNoEmail()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);

        using var response = await UserFixtures.ActionAsync(client, manager.AccessToken, staff.Id, Action);

        await AssertRefusedAsync(response, "users.already-set-up", "This person has already set up their account.");
        (await AuthClient.ReadEmailsAsync(client, staff.Email)).ShouldBeEmpty();
        (await AuditOfAsync(staff.Id)).ShouldBeEmpty();
    }

    [Theory]
    [InlineData("deactivated")]
    [InlineData("locked")]
    public async Task ABlockedInvitedPersonIsRefusedWith422AndGetsNoEmail(string state)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var invited = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Hal", "Honrado", Roles.Admin, withPassword: false);
        await UserFixtures.AddInvitationAsync(database, invited.Id, expired: false);
        if (state == "deactivated")
        {
            await AuthClient.DeactivateAsync(factory, invited.Id);
        }
        else
        {
            await AccountStateFixtures.ManagerLockAsync(factory, invited.Id);
        }

        using var response = await UserFixtures.ActionAsync(client, manager.AccessToken, invited.Id, Action);

        await AssertRefusedAsync(response, "users.blocked", "Unlock or activate this person first.");
        (await AuthClient.ReadEmailsAsync(client, invited.Email)).ShouldBeEmpty();
        (await AuditOfAsync(invited.Id)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AnUnknownOrDeletedPersonAnswers404()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var deleted = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Jun", "Javier", Roles.Admin, withPassword: false);
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
        var invited = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Hal", "Honrado", Roles.Admin, withPassword: false);

        using (var forbidden = await UserFixtures.ActionAsync(client, admin.AccessToken, invited.Id, Action))
        {
            forbidden.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        }

        using (var anonymous = await UserFixtures.ActionAsync(client, null, invited.Id, Action))
        {
            anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        }

        (await AuthClient.ReadEmailsAsync(client, invited.Email)).ShouldBeEmpty();
    }

    [Fact]
    public async Task ARepeatedRequestKeyAnswersTheStoredResultAndSendsOnlyOneInvitation()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var invited = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Hal", "Honrado", Roles.Admin, withPassword: false);
        var key = Guid.NewGuid().ToString("D");

        for (var attempt = 0; attempt < 2; attempt++)
        {
            using var request = ApiRequests.Create(HttpMethod.Post, $"{UserFixtures.Route}/{invited.Id:D}/{Action}", manager.AccessToken);
            request.Headers.Add(AuthClient.IdempotencyKeyHeader, key);
            using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        (await AuthClient.WaitForEmailsAsync(client, invited.Email)).ShouldHaveSingleItem();
        (await AuditOfAsync(invited.Id)).ShouldHaveSingleItem();
    }

    private static async Task<Guid> InviteAsync(HttpClient client, string accessToken, string email)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, UserFixtures.Route, accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        request.Content = JsonContent.Create(new { firstName = "Ana", lastName = "Abad", email, role = "Admin", access = "invitation" });
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task AssertRefusedAsync(HttpResponseMessage response, string code, string message)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe(code);
        problem.GetProperty("detail").GetString().ShouldBe(message);
    }

    private async Task<List<AuditEntry>> AuditOfAsync(Guid userId)
    {
        await using var context = database.CreateContext();
        var key = userId.ToString("D");
        return await context.AuditLog.AsNoTracking()
            .Where(entry => entry.TargetId == key && entry.Action == ResentAction)
            .OrderBy(entry => entry.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
    }
}
