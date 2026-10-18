using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Users;

/// <summary>SEC-08, D-08, D-09, D-11, USER-08: a Manager reads one person with who created and last changed them, from those people's own rows.</summary>
public sealed class GetUserEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string DeletedDetail = "This user was deleted.";

    [Fact]
    public async Task AManagerReadsEveryDetailFieldAndTheVersion()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var reader = await TestSessions.StartAsync(factory, Roles.Manager);
        var tag = UserFixtures.NewTag();
        var creator = await UserFixtures.CreateAsync(factory, tag, "Cora", "Creator");
        var editor = await UserFixtures.CreateAsync(factory, tag, "Edna", "Editor", Roles.Admin);
        var target = await UserFixtures.CreateAsync(factory, tag, "Tess", "Target", Roles.Admin);
        var changedAt = new DateTimeOffset(2026, 10, 1, 3, 4, 5, TimeSpan.Zero);
        await UserFixtures.StampAsync(database, target.Id, creator.Id, editor.Id, changedAt);

        using var response = await UserFixtures.GetAsync(client, reader.AccessToken, target.Id);
        var detail = await UserFixtures.ReadDetailAsync(client, reader.AccessToken, target.Id);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        detail.GetProperty("id").GetGuid().ShouldBe(target.Id);
        detail.GetProperty("firstName").GetString().ShouldBe(target.FirstName);
        detail.GetProperty("lastName").GetString().ShouldBe(target.LastName);
        detail.GetProperty("email").GetString().ShouldBe(target.Email);
        detail.GetProperty("role").GetString().ShouldBe(Roles.Admin);
        detail.GetProperty("status").GetString().ShouldBe("active");
        detail.GetProperty("inviteState").GetString().ShouldBe("none");
        detail.GetProperty("createdAt").GetDateTimeOffset().Offset.ShouldBe(TimeSpan.Zero);
        detail.GetProperty("hasPassword").GetBoolean().ShouldBeTrue();
        detail.GetProperty("managerLocked").GetBoolean().ShouldBeFalse();
        detail.GetProperty("pendingEmail").ValueKind.ShouldBe(JsonValueKind.Null);
        detail.GetProperty("updatedAt").GetDateTimeOffset().ShouldBe(changedAt);
        detail.GetProperty("version").GetGuid().ShouldNotBe(Guid.Empty);
        AssertActor(detail.GetProperty("recordedBy"), creator, formerStaff: false);
        AssertActor(detail.GetProperty("lastChangedBy"), editor, formerStaff: false);
    }

    [Fact]
    public async Task AnAccountFromBeforePhase5HasNoRecorderAndNoLastChanger()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var reader = await TestSessions.StartAsync(factory, Roles.Manager);
        var old = await AuthClient.CreateStaffAsync(factory);

        var detail = await UserFixtures.ReadDetailAsync(client, reader.AccessToken, old.Id);

        detail.GetProperty("recordedBy").ValueKind.ShouldBe(JsonValueKind.Null);
        detail.GetProperty("lastChangedBy").ValueKind.ShouldBe(JsonValueKind.Null);
        detail.GetProperty("updatedAt").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task ADeletedRecorderKeepsTheirNameAndIsMarkedFormerStaff()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var reader = await TestSessions.StartAsync(factory, Roles.Manager);
        var tag = UserFixtures.NewTag();
        var creator = await UserFixtures.CreateAsync(factory, tag, "Cora", "Creator");
        var target = await UserFixtures.CreateAsync(factory, tag, "Tess", "Target");
        await UserFixtures.StampAsync(database, target.Id, creator.Id, creator.Id, TimeProvider.System.GetUtcNow());
        await AccountStateFixtures.MarkDeletedAsync(factory, creator.Id);

        var detail = await UserFixtures.ReadDetailAsync(client, reader.AccessToken, target.Id);

        AssertActor(detail.GetProperty("recordedBy"), creator, formerStaff: true);
        AssertActor(detail.GetProperty("lastChangedBy"), creator, formerStaff: true);
    }

    [Fact]
    public async Task ARecorderWhoRenamesThemselfShowsUnderTheNewName()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var reader = await TestSessions.StartAsync(factory, Roles.Manager);
        var creator = await TestSessions.StartAsync(factory, Roles.Manager);
        var target = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Tess", "Target");
        await UserFixtures.StampAsync(database, target.Id, creator.UserId, null, null);
        var before = await UserFixtures.ReadDetailAsync(client, reader.AccessToken, target.Id);
        before.GetProperty("recordedBy").GetProperty("name").GetString().ShouldBe("Paolo Reyes");

        await RenameAsync(client, creator.AccessToken, "Rina", "Santos");
        var after = await UserFixtures.ReadDetailAsync(client, reader.AccessToken, target.Id);

        after.GetProperty("recordedBy").GetProperty("name").GetString().ShouldBe("Rina Santos");
        after.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(creator.UserId);
    }

    [Fact]
    public async Task ALockedInvitedAccountWithAPendingEmailShowsAllThreeFlags()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var reader = await TestSessions.StartAsync(factory, Roles.Manager);
        var invited = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Ina", "Invited", Roles.Admin, withPassword: false);
        await UserFixtures.AddInvitationAsync(database, invited.Id, expired: false);
        await AccountStateFixtures.ManagerLockAsync(factory, invited.Id);
        await UserFixtures.SetPendingEmailAsync(database, invited.Id, "ina.new@example.com");

        var detail = await UserFixtures.ReadDetailAsync(client, reader.AccessToken, invited.Id);

        detail.GetProperty("hasPassword").GetBoolean().ShouldBeFalse();
        detail.GetProperty("managerLocked").GetBoolean().ShouldBeTrue();
        detail.GetProperty("status").GetString().ShouldBe("locked");
        detail.GetProperty("inviteState").GetString().ShouldBe("pending");
        detail.GetProperty("pendingEmail").GetString().ShouldBe("ina.new@example.com");
    }

    [Fact]
    public async Task ADeactivatedAndLockedAccountReadsAsInactiveButStillShowsTheLock()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var reader = await TestSessions.StartAsync(factory, Roles.Manager);
        var both = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Bo", "Both");
        await AuthClient.DeactivateAsync(factory, both.Id);
        await AccountStateFixtures.ManagerLockAsync(factory, both.Id);

        var detail = await UserFixtures.ReadDetailAsync(client, reader.AccessToken, both.Id);

        detail.GetProperty("status").GetString().ShouldBe("inactive");
        detail.GetProperty("managerLocked").GetBoolean().ShouldBeTrue();
    }

    [Fact]
    public async Task ADeletedOrUnknownUserIsA404WithTheSameWords()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var reader = await TestSessions.StartAsync(factory, Roles.Manager);
        var gone = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Gus", "Gone");
        await AccountStateFixtures.MarkDeletedAsync(factory, gone.Id);

        using var deleted = await UserFixtures.GetAsync(client, reader.AccessToken, gone.Id);
        using var unknown = await UserFixtures.GetAsync(client, reader.AccessToken, Guid.NewGuid());

        foreach (var response in new[] { deleted, unknown })
        {
            response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
            var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
            problem.GetProperty("code").GetString().ShouldBe("users.not-found");
            problem.GetProperty("detail").GetString().ShouldBe(DeletedDetail);
        }
    }

    [Fact]
    public async Task AnAdminIsRefusedWith403AndAnAnonymousCallerWith401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var someone = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Sam", "Someone");

        using var asAdmin = await UserFixtures.GetAsync(client, admin.AccessToken, someone.Id);
        using var anonymous = await UserFixtures.GetAsync(client, null, someone.Id);

        asAdmin.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    private static void AssertActor(JsonElement actor, SeededUser expected, bool formerStaff)
    {
        actor.GetProperty("id").GetGuid().ShouldBe(expected.Id);
        actor.GetProperty("name").GetString().ShouldBe($"{expected.FirstName} {expected.LastName}");
        actor.GetProperty("formerStaff").GetBoolean().ShouldBe(formerStaff);
    }

    private static async Task RenameAsync(HttpClient client, string accessToken, string firstName, string lastName)
    {
        using var read = await client.SendAsync(ApiRequests.Get("/api/v1/profile", accessToken), TestContext.Current.CancellationToken);
        using var profile = JsonDocument.Parse(await read.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var version = profile.RootElement.GetProperty("version").GetString();
        using var save = ApiRequests.Create(HttpMethod.Put, "/api/v1/profile", accessToken);
        save.Content = JsonContent.Create(new { firstName, lastName, version });
        using var response = await client.SendAsync(save, TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}
