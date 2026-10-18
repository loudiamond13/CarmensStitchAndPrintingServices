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
/// USER-03, USER-06, SEC-07, SEC-08, D-19, D-20, D-40: a Manager edits another person's name with the edit version they loaded. A
/// real change is audited with field names only; an identical save, a bad form and the caller's own account change nothing.
/// </summary>
public sealed class UpdateUserEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string DetailsChanged = "user.details-changed";
    private const string RoleChanged = "user.role-changed";

    [Fact]
    public async Task AManagerRenamesAColleagueWithTheVersionTheyLoadedAndTheChangeIsAttributedAndAudited()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Ned", "Reyes", Roles.Admin);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);

        using var response = await PutAsync(client, manager.AccessToken, person.Id, Form("Neda", "Santos", "Admin", before));

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var saved = await ReadAsync(response);
        saved.GetProperty("firstName").GetString().ShouldBe("Neda");
        saved.GetProperty("lastName").GetString().ShouldBe("Santos");
        saved.GetProperty("version").GetGuid().ShouldNotBe(before.GetProperty("version").GetGuid());
        saved.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);

        var stored = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);
        stored.GetProperty("firstName").GetString().ShouldBe("Neda");
        stored.GetProperty("version").GetGuid().ShouldBe(saved.GetProperty("version").GetGuid());

        var entry = (await AuditOfAsync(person.Id, DetailsChanged)).ShouldHaveSingleItem();
        entry.ActorUserId.ShouldBe(manager.UserId);
        entry.TargetType.ShouldBe("User");
        entry.Detail.ShouldBe("fields=first-name,last-name");
    }

    [Fact]
    public async Task OnlyTheFieldThatChangedIsNamedAndNoNameOrEmailEntersTheAuditLog()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Ned", "Reyes", Roles.Admin);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);

        using var response = await PutAsync(client, manager.AccessToken, person.Id, Form(person.FirstName, "Santos", "Admin", before));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var entry = (await AuditOfAsync(person.Id, DetailsChanged)).ShouldHaveSingleItem();
        entry.Detail.ShouldBe("fields=last-name");
        var detail = entry.Detail.ShouldNotBeNull();
        detail.ShouldNotContain("Santos");
        detail.ShouldNotContain(person.Email);
    }

    [Fact]
    public async Task SavingTheValuesAlreadyStoredAnswers200WritesNoAuditEntryAndKeepsTheVersion()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Ned", "Reyes", Roles.Admin);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);

        using var response = await PutAsync(client, manager.AccessToken, person.Id, Form(person.FirstName, person.LastName, "Admin", before));

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await ReadAsync(response)).GetProperty("version").GetGuid().ShouldBe(before.GetProperty("version").GetGuid());
        (await AuditOfAsync(person.Id, DetailsChanged)).ShouldBeEmpty();
        (await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id)).GetProperty("lastChangedBy").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task ResendingASuccessfulSaveWithItsOldVersionAnswers409AndChangesNothingMore()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Ned", "Reyes", Roles.Admin);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);
        using (var first = await PutAsync(client, manager.AccessToken, person.Id, Form("Neda", "Santos", "Admin", before)))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        using var again = await PutAsync(client, manager.AccessToken, person.Id, Form("Nedo", "Cruz", "Admin", before));

        again.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var problem = await ProblemJson.ReadAsync(again, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("edit.stale");
        problem.GetProperty("detail").GetString().ShouldBe("This was changed by someone else. Reload and try again.");
        (await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id)).GetProperty("firstName").GetString().ShouldBe("Neda");
        (await AuditOfAsync(person.Id, DetailsChanged)).Count.ShouldBe(1);
    }

    [Theory]
    [InlineData("", "Santos", "Admin", true, "firstName", "Enter a first name.")]
    [InlineData("Neda", "   ", "Admin", true, "lastName", "Enter a last name.")]
    [InlineData("Neda", "Santos", "Owner", true, "role", "Choose a role.")]
    [InlineData("Neda", "Santos", null, true, "role", "Choose a role.")]
    [InlineData("Neda", "Santos", "Admin", false, "version", "Reload the form and try again.")]
    public async Task ABadFormAnswers400WithTheFieldMessageAndChangesNothing(string? first, string? last, string? role, bool sendVersion, string field, string message)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Ned", "Reyes", Roles.Admin);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);
        var version = sendVersion ? before.GetProperty("version").GetString() : null;

        using var response = await PutAsync(client, manager.AccessToken, person.Id, new { firstName = first, lastName = last, role, version, email = person.Email });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty(field).EnumerateArray().Select(item => item.GetString()).ShouldBe([message]);
        var after = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);
        after.GetProperty("version").GetGuid().ShouldBe(before.GetProperty("version").GetGuid());
        after.GetProperty("firstName").GetString().ShouldBe(person.FirstName);
    }

    [Fact]
    public async Task AManagerCannotEditTheirOwnAccountHereAndNothingChanges()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, manager.UserId);

        using var response = await PutAsync(client, manager.AccessToken, manager.UserId, Form("Paola", "Reyes", "Manager", before));

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("users.own-account");
        (await UserFixtures.ReadDetailAsync(client, manager.AccessToken, manager.UserId)).GetProperty("firstName").GetString().ShouldBe("Paolo");
    }

    [Fact]
    public async Task AnUnknownOrDeletedPersonAnswers404()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var deleted = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Jun", "Javier", Roles.Admin);
        await AccountStateFixtures.MarkDeletedAsync(factory, deleted.Id);
        var form = new { firstName = "Neda", lastName = "Santos", role = "Admin", version = Guid.NewGuid().ToString("D"), email = "neda@example.com" };

        foreach (var id in new[] { Guid.NewGuid(), deleted.Id })
        {
            using var response = await PutAsync(client, manager.AccessToken, id, form);

            response.StatusCode.ShouldBe(HttpStatusCode.NotFound, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("users.not-found");
        }
    }

    [Fact]
    public async Task AFailedPasswordBetweenOpeningTheFormAndSavingDoesNotCauseAFalse409()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        using var otherClient = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Ned", "Reyes", Roles.Admin);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);
        using (var wrong = await AuthClient.SignInAsync(otherClient, person.Email, "Not-the-password-1!"))
        {
            wrong.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        }

        using var response = await PutAsync(client, manager.AccessToken, person.Id, Form("Neda", "Santos", "Admin", before));

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task AnAdminIsRefusedWith403AndNothingChanges()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Ned", "Reyes", Roles.Admin);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);

        using var response = await PutAsync(client, admin.AccessToken, person.Id, Form("Neda", "Santos", "Admin", before));

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id)).GetProperty("firstName").GetString().ShouldBe(person.FirstName);
    }

    [Fact]
    public async Task PromotingAnAdminToManagerSignsThemOutAtOnceAndRecordsTheRoleChange()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await TestSessions.StartAsync(factory, Roles.Admin);
        (await AuthClient.SiteSettingsStatusAsync(client, person.AccessToken)).ShouldBe(HttpStatusCode.OK);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.UserId);

        using var response = await PutAsync(client, manager.AccessToken, person.UserId, Form("Paolo", "Reyes", "Manager", before));

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var saved = await ReadAsync(response);
        saved.GetProperty("role").GetString().ShouldBe("Manager");
        saved.GetProperty("version").GetGuid().ShouldNotBe(before.GetProperty("version").GetGuid());
        saved.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);

        // The very next request with the old token is refused, so the old role claim dies with the session.
        (await AuthClient.SiteSettingsStatusAsync(client, person.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);

        var role = (await AuditOfAsync(person.UserId, RoleChanged)).ShouldHaveSingleItem();
        role.Detail.ShouldBe("role=admin>manager");
        role.ActorUserId.ShouldBe(manager.UserId);
        (await AuditOfAsync(person.UserId, DetailsChanged)).ShouldBeEmpty();
        (await AuditOfAsync(person.UserId, "auth.sessions-revoked")).ShouldHaveSingleItem().Detail.ShouldBe("account-changed");
    }

    [Fact]
    public async Task ASaveThatChangesTheNameAndTheRoleWritesTwoSeparateEntries()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var other = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Maya", "Lopez", Roles.Manager);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, other.Id);

        using var response = await PutAsync(client, manager.AccessToken, other.Id, Form("Mayo", other.LastName, "Admin", before));

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await AuditOfAsync(other.Id, DetailsChanged)).ShouldHaveSingleItem().Detail.ShouldBe("fields=first-name");
        (await AuditOfAsync(other.Id, RoleChanged)).ShouldHaveSingleItem().Detail.ShouldBe("role=manager>admin");
        (await UserFixtures.ReadDetailAsync(client, manager.AccessToken, other.Id)).GetProperty("role").GetString().ShouldBe("Admin");
    }

    [Theory]
    [InlineData("admin")]
    [InlineData("ADMIN")]
    public async Task TheRoleIsReadInAnyLetterCase(string spelling)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Ned", "Reyes", Roles.Admin);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);

        using var response = await PutAsync(client, manager.AccessToken, person.Id, Form("Neda", "Reyes", spelling, before));

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await AuditOfAsync(person.Id, RoleChanged)).ShouldBeEmpty();
    }

    [Fact]
    public async Task ANameOnlyEditKeepsTheRoleAndDoesNotSignThePersonOut()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await TestSessions.StartAsync(factory, Roles.Admin);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.UserId);

        using var response = await PutAsync(client, manager.AccessToken, person.UserId, Form("Paola", "Reyes", "Admin", before));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await AuthClient.SiteSettingsStatusAsync(client, person.AccessToken)).ShouldBe(HttpStatusCode.OK);
        (await AuditOfAsync(person.UserId, RoleChanged)).ShouldBeEmpty();
        (await AuditOfAsync(person.UserId, "auth.sessions-revoked")).ShouldBeEmpty();
    }

    [Fact]
    public async Task AManagerDemotesAnotherManagerWhileOneActiveManagerRemains()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var a = await TestSessions.StartAsync(factory, Roles.Manager);
        var b = await TestSessions.StartAsync(factory, Roles.Manager);
        var before = await UserFixtures.ReadDetailAsync(client, a.AccessToken, b.UserId);

        using var response = await PutAsync(client, a.AccessToken, b.UserId, Form("Paolo", "Reyes", "Admin", before));

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await ActiveManagersAsync()).ShouldBe([a.UserId]);
    }

    [Fact]
    public async Task TwoManagersDemotingEachOtherTogetherLeaveExactlyOneActiveManagerEveryTime()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        for (var run = 0; run < 20; run++)
        {
            // Each run starts from an empty roster, so the one survivor is the only active Manager.
            await database.ResetAsync();
            var a = await TestSessions.StartAsync(factory, Roles.Manager);
            var b = await TestSessions.StartAsync(factory, Roles.Manager);
            var aDetail = await UserFixtures.ReadDetailAsync(client, b.AccessToken, a.UserId);
            var bDetail = await UserFixtures.ReadDetailAsync(client, a.AccessToken, b.UserId);

            // A warm session cache keeps the loser's token valid until the winner's eviction, so the 422 comes from the guard.
            (await AuthClient.SiteSettingsStatusAsync(client, a.AccessToken)).ShouldBe(HttpStatusCode.OK, $"run {run}");
            (await AuthClient.SiteSettingsStatusAsync(client, b.AccessToken)).ShouldBe(HttpStatusCode.OK, $"run {run}");

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => PutAsync(client, a.AccessToken, b.UserId, Form("Paolo", "Reyes", "Admin", bDetail)),
                () => PutAsync(client, b.AccessToken, a.UserId, Form("Paolo", "Reyes", "Admin", aDetail)));
            using (first)
            using (second)
            {
                new[] { first.StatusCode, second.StatusCode }.Order().ToArray()
                    .ShouldBe([HttpStatusCode.OK, HttpStatusCode.UnprocessableEntity], $"run {run}");
                var loser = first.StatusCode == HttpStatusCode.UnprocessableEntity ? first : second;
                (await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("users.last-active-manager", $"run {run}");
            }

            (await ActiveManagersAsync()).Count.ShouldBe(1, $"run {run}");
        }
    }

    [Fact]
    public async Task DemotingTheOnlyOtherActiveManagerIsRefusedWhenTheCallerIsManagerLocked()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var a = await TestSessions.StartAsync(factory, Roles.Manager);
        var b = await TestSessions.StartAsync(factory, Roles.Manager);
        var before = await UserFixtures.ReadDetailAsync(client, a.AccessToken, b.UserId);
        await AccountStateFixtures.ManagerLockAsync(factory, a.UserId);

        using var response = await PutAsync(client, a.AccessToken, b.UserId, Form("Paolo", "Reyes", "Admin", before));

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("users.last-active-manager");
        (await ActiveManagersAsync()).ShouldBe([b.UserId]);
        (await AuditOfAsync(b.UserId, RoleChanged)).ShouldBeEmpty();
    }

    // Managers who are active and neither Manager-locked nor deleted, read straight from the database.
    private async Task<List<Guid>> ActiveManagersAsync()
    {
        await using var context = database.CreateContext();
        var managerRole = await context.Roles.AsNoTracking().Where(role => role.Name == Roles.Manager).Select(role => role.Id).SingleAsync(TestContext.Current.CancellationToken);
        return await context.Users.AsNoTracking()
            .Where(user => user.IsActive && user.ManagerLockedAtUtc == null && user.DeletedAtUtc == null)
            .Where(user => context.UserRoles.Any(link => link.UserId == user.Id && link.RoleId == managerRole))
            .Select(user => user.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    private static object Form(string firstName, string lastName, string role, JsonElement loaded) =>
        new { firstName, lastName, role, version = loaded.GetProperty("version").GetString(), email = loaded.GetProperty("email").GetString() };

    private static async Task<HttpResponseMessage> PutAsync(HttpClient client, string? accessToken, Guid id, object body)
    {
        using var request = ApiRequests.Create(HttpMethod.Put, $"{UserFixtures.Route}/{id:D}", accessToken);
        request.Content = JsonContent.Create(body);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return document.RootElement.Clone();
    }

    private async Task<List<Csps.Domain.Auditing.AuditEntry>> AuditOfAsync(Guid userId, string action)
    {
        await using var context = database.CreateContext();
        var key = userId.ToString("D");
        return await context.AuditLog.AsNoTracking()
            .Where(entry => entry.TargetId == key && entry.Action == action)
            .OrderBy(entry => entry.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
    }
}
