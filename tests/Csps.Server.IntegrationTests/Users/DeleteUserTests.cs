using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Users;

/// <summary>
/// USER-03, D-07..D-11, D-40: a Manager deletes a staff member as a final soft delete. The person is signed out at once, cannot sign in
/// or use an old link, drops off the roster and the detail answers 404, their address is free for a new invitation, and the records
/// they created keep pointing at the row so their name still shows as former staff.
/// </summary>
public sealed class DeleteUserTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string LinkInvalidCode = "auth.link-invalid";
    private const string NotFoundCode = "users.not-found";
    private const string DeletedDomain = "@deleted.invalid";
    private const string DeletedAction = "user.deleted";

    [Fact]
    public async Task ADeletedColleagueIsSignedOutCannotSignInOrUseALinkAndTheirNameStaysOnWhatTheyRecorded()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var managerClient = AuthClient.CreateClient(factory);
        using var colleagueClient = AuthClient.CreateClient(factory);
        using var mailbox = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var recorded = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Yara", "Recorded", Roles.Admin);
        await UserFixtures.StampAsync(database, recorded.Id, staff.Id, staff.Id, TimeProvider.System.GetUtcNow());
        var device = await AuthClient.SignInFullyAsync(colleagueClient, staff);
        (await AuthClient.SiteSettingsStatusAsync(colleagueClient, device.AccessToken)).ShouldBe(HttpStatusCode.OK);
        var linkBeforeDelete = await AuthClient.RequestResetTokenAsync(mailbox, staff.Email, emailsSoFar: 1);
        var before = await ReadRowAsync(staff.Id);

        using (var deleted = await UserFixtures.DeleteAsync(managerClient, manager.AccessToken, staff.Id))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent, await deleted.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        // The very next request with the old token, and a refresh, are both refused; so is signing in with the old address.
        (await AuthClient.SiteSettingsStatusAsync(colleagueClient, device.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);
        using (var refresh = await AuthClient.RefreshAsync(colleagueClient))
        {
            refresh.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        }

        using (var freshClient = AuthClient.CreateClient(factory))
        using (var signIn = await AuthClient.SignInAsync(freshClient, staff.Email, staff.Password))
        {
            signIn.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        }

        // A reset link issued before the delete no longer works.
        using (var check = await AuthClient.CheckResetLinkAsync(mailbox, linkBeforeDelete))
        using (var reset = await AuthClient.ResetPasswordAsync(mailbox, linkBeforeDelete, "Brand-New-Pass-7731"))
        {
            await AssertInvalidLinkAsync(check);
            await AssertInvalidLinkAsync(reset);
        }

        // The roster no longer lists the person and their detail is a 404.
        (await UserFixtures.ReadPageAsync(managerClient, manager.AccessToken, $"q={Uri.EscapeDataString(staff.Email)}")).Items.ShouldBeEmpty();
        using (var detail = await UserFixtures.GetAsync(managerClient, manager.AccessToken, staff.Id))
        {
            detail.StatusCode.ShouldBe(HttpStatusCode.NotFound);
            (await ProblemJson.ReadAsync(detail, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe(NotFoundCode);
        }

        // D-08: what the person recorded still shows their name, now as former staff.
        var recordedDetail = await UserFixtures.ReadDetailAsync(managerClient, manager.AccessToken, recorded.Id);
        foreach (var field in new[] { "recordedBy", "lastChangedBy" })
        {
            var actor = recordedDetail.GetProperty(field);
            actor.GetProperty("id").GetGuid().ShouldBe(staff.Id);
            actor.GetProperty("name").GetString().ShouldBe($"{before.FirstName} {before.LastName}");
            actor.GetProperty("formerStaff").GetBoolean().ShouldBeTrue();
        }

        // D-07: the row is kept, the name stays, and the address is scrambled unique per id.
        var after = await ReadRowAsync(staff.Id);
        var scrambled = $"deleted-{staff.Id:N}{DeletedDomain}";
        after.Email.ShouldBe(scrambled);
        after.UserName.ShouldBe(scrambled);
        after.NormalizedEmail.ShouldBe(scrambled.ToUpperInvariant());
        after.NormalizedUserName.ShouldBe(scrambled.ToUpperInvariant());
        after.PendingEmail.ShouldBeNull();
        after.FirstName.ShouldBe(before.FirstName);
        after.LastName.ShouldBe(before.LastName);
        after.DeletedAtUtc.ShouldNotBeNull();
        after.EditVersion.ShouldNotBe(before.EditVersion);
        after.SecurityStamp.ShouldNotBe(before.SecurityStamp);
    }

    [Fact]
    public async Task ASecondDeleteOfTheSamePersonAnswers404AndRecordsNothingNew()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Dan", "Twice", Roles.Admin);

        using (var first = await UserFixtures.DeleteAsync(client, manager.AccessToken, person.Id))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var afterFirst = await ReadRowAsync(person.Id);
        using (var second = await UserFixtures.DeleteAsync(client, manager.AccessToken, person.Id))
        {
            second.StatusCode.ShouldBe(HttpStatusCode.NotFound);
            var problem = await ProblemJson.ReadAsync(second, TestContext.Current.CancellationToken);
            problem.GetProperty("code").GetString().ShouldBe(NotFoundCode);
            problem.GetProperty("detail").GetString().ShouldBe("This user was deleted.");
        }

        (await CountAuditAsync(person.Id, DeletedAction)).ShouldBe(1);
        var afterSecond = await ReadRowAsync(person.Id);
        afterSecond.EditVersion.ShouldBe(afterFirst.EditVersion);
        afterSecond.DeletedAtUtc.ShouldBe(afterFirst.DeletedAtUtc);
    }

    [Fact]
    public async Task AnUnknownPersonAnswers404()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await UserFixtures.DeleteAsync(client, manager.AccessToken, Guid.NewGuid());

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe(NotFoundCode);
    }

    [Fact]
    public async Task TheFreedAddressCanBeInvitedAgainAndMakesASeparateNewAccount()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var old = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Olga", "Old", Roles.Admin);

        using (var deleted = await UserFixtures.DeleteAsync(client, manager.AccessToken, old.Id))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using var invite = await InviteAsync(client, manager.AccessToken, old.Email);

        invite.StatusCode.ShouldBe(HttpStatusCode.Created, await invite.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        using var body = JsonDocument.Parse(await invite.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var newId = body.RootElement.GetProperty("id").GetGuid();
        newId.ShouldNotBe(old.Id);
        (await ReadRowAsync(old.Id)).DeletedAtUtc.ShouldNotBeNull();
        (await ReadRowAsync(newId)).Email.ShouldBe(old.Email);
    }

    [Fact]
    public async Task DeletingIsAuditedAgainstTheUserWithNoDetailByTheManager()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Ari", "Audited", Roles.Admin);

        (await UserFixtures.DeleteAsync(client, manager.AccessToken, person.Id)).Dispose();

        await using var context = database.CreateContext();
        var key = person.Id.ToString("D");
        var entry = await context.AuditLog.AsNoTracking()
            .Where(candidate => candidate.TargetId == key && candidate.Action == DeletedAction)
            .SingleAsync(TestContext.Current.CancellationToken);
        entry.TargetType.ShouldBe("User");
        entry.Detail.ShouldBeNull();
        entry.ActorUserId.ShouldBe(manager.UserId);
    }

    [Fact]
    public async Task AnAdminIsRefusedWith403AnAnonymousCallerWith401AndNothingIsDeleted()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Una", "Untouched", Roles.Admin);

        using var asAdmin = await UserFixtures.DeleteAsync(client, admin.AccessToken, person.Id);
        using var anonymous = await UserFixtures.DeleteAsync(client, null, person.Id);

        asAdmin.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await ReadRowAsync(person.Id)).DeletedAtUtc.ShouldBeNull();
    }

    [Theory]
    [InlineData("restore")]
    [InlineData("undelete")]
    public async Task ThereIsNoWayToBringADeletedPersonBack(string action)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Rey", "Final", Roles.Admin);
        (await UserFixtures.DeleteAsync(client, manager.AccessToken, person.Id)).Dispose();

        using var response = await UserFixtures.ActionAsync(client, manager.AccessToken, person.Id, action);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        using var activate = await UserFixtures.ActionAsync(client, manager.AccessToken, person.Id, "activate");
        activate.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ReadRowAsync(person.Id)).DeletedAtUtc.ShouldNotBeNull();
    }

    private static async Task<HttpResponseMessage> InviteAsync(HttpClient client, string accessToken, string email)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, UserFixtures.Route, accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        request.Content = JsonContent.Create(new Dictionary<string, object?>
        {
            ["firstName"] = "Olga",
            ["lastName"] = "Again",
            ["email"] = email,
            ["role"] = Roles.Admin,
            ["access"] = "invitation",
            ["temporaryPassword"] = null,
        });
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task AssertInvalidLinkAsync(HttpResponseMessage response)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe(LinkInvalidCode);
    }

    private async Task<StoredUser> ReadRowAsync(Guid id)
    {
        await using var context = database.CreateContext();
        var user = await context.Users.AsNoTracking().SingleAsync(candidate => candidate.Id == id, TestContext.Current.CancellationToken);
        return new StoredUser(
            user.FirstName, user.LastName, user.Email, user.UserName, user.NormalizedEmail, user.NormalizedUserName, user.PendingEmail,
            user.DeletedAtUtc, user.EditVersion, user.SecurityStamp);
    }

    private async Task<int> CountAuditAsync(Guid id, string action)
    {
        await using var context = database.CreateContext();
        var key = id.ToString("D");
        return await context.AuditLog.AsNoTracking().CountAsync(entry => entry.TargetId == key && entry.Action == action, TestContext.Current.CancellationToken);
    }

    private sealed record StoredUser(
        string FirstName,
        string LastName,
        string? Email,
        string? UserName,
        string? NormalizedEmail,
        string? NormalizedUserName,
        string? PendingEmail,
        DateTimeOffset? DeletedAtUtc,
        Guid EditVersion,
        string? SecurityStamp);
}
