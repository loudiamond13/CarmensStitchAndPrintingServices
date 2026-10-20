using System.Net;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Users;

/// <summary>
/// USER-03, USER-05, USER-06, D-16, D-21, D-40: a Manager deactivates and reactivates staff. Deactivating ends every session of
/// that person at once, and the person cannot sign in again until reactivated.
/// </summary>
public sealed class UserLifecycleTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task ADeactivatedColleagueIsSignedOutAtOnceCannotSignInAndComesBackWhenActivated()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var managerClient = AuthClient.CreateClient(factory);
        using var colleagueClient = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var device = await AuthClient.SignInFullyAsync(colleagueClient, staff);
        (await AuthClient.SiteSettingsStatusAsync(colleagueClient, device.AccessToken)).ShouldBe(HttpStatusCode.OK);

        using (var deactivated = await PostAsync(managerClient, manager.AccessToken, staff.Id, "deactivate"))
        {
            deactivated.StatusCode.ShouldBe(HttpStatusCode.NoContent, await deactivated.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
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

        (await UserFixtures.ReadPageAsync(managerClient, manager.AccessToken, $"q={Uri.EscapeDataString(staff.Email)}")).Items.ShouldHaveSingleItem().Status.ShouldBe("inactive");

        using (var activated = await PostAsync(managerClient, manager.AccessToken, staff.Id, "activate"))
        {
            activated.StatusCode.ShouldBe(HttpStatusCode.NoContent, await activated.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        (await UserFixtures.ReadPageAsync(managerClient, manager.AccessToken, $"q={Uri.EscapeDataString(staff.Email)}")).Items.ShouldHaveSingleItem().Status.ShouldBe("active");
        using var backClient = AuthClient.CreateClient(factory);
        using var back = await AuthClient.SignInThroughCodeAsync(backClient, staff, signInsSoFar: 1);
        back.StatusCode.ShouldBe(HttpStatusCode.OK);

        await using var context = database.CreateContext();
        var key = staff.Id.ToString("D");
        var entries = await context.AuditLog.AsNoTracking()
            .Where(entry => entry.TargetId == key && (entry.Action.StartsWith("user.") || entry.Action == AuditActions.SessionsRevoked))
            .OrderBy(entry => entry.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
        entries.Select(entry => entry.Action).ShouldBe([AuditActions.SessionsRevoked, "user.deactivated", "user.activated"], ignoreOrder: true);
        entries.ShouldAllBe(entry => entry.ActorUserId == manager.UserId && entry.TargetType == "User");
        entries.Single(entry => entry.Action == AuditActions.SessionsRevoked).Detail.ShouldBe("account-changed");
        entries.Where(entry => entry.Action.StartsWith("user.", StringComparison.Ordinal)).ShouldAllBe(entry => entry.Detail == null);
    }

    [Fact]
    public async Task DeactivatingRotatesTheEditVersionAndStampsTheManagerAsTheLastChanger()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Ned", "Version", Roles.Admin);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);

        using (var response = await PostAsync(client, manager.AccessToken, person.Id, "deactivate"))
        {
            response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var after = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);
        after.GetProperty("version").GetGuid().ShouldNotBe(before.GetProperty("version").GetGuid());
        after.GetProperty("status").GetString().ShouldBe("inactive");
        after.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
    }

    [Fact]
    public async Task RepeatingADeactivateOrAnActivateAnswers204AndChangesAndRecordsNothingMore()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Rex", "Repeat", Roles.Admin);

        using (var activeAlready = await PostAsync(client, manager.AccessToken, person.Id, "activate"))
        {
            activeAlready.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        (await CountAuditAsync(person.Id, "user.activated")).ShouldBe(0);
        using (var first = await PostAsync(client, manager.AccessToken, person.Id, "deactivate"))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var afterFirst = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);
        using (var second = await PostAsync(client, manager.AccessToken, person.Id, "deactivate"))
        {
            second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        (await CountAuditAsync(person.Id, "user.deactivated")).ShouldBe(1);
        var afterSecond = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id);
        afterSecond.GetProperty("version").GetGuid().ShouldBe(afterFirst.GetProperty("version").GetGuid());
    }

    [Fact]
    public async Task AnAdminIsRefusedWith403AnAnonymousCallerWith401AndAnUnknownPersonWith404()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Una", "Untouched", Roles.Admin);

        foreach (var action in new[] { "deactivate", "activate" })
        {
            using var asAdmin = await PostAsync(client, admin.AccessToken, person.Id, action);
            using var anonymous = await PostAsync(client, null, person.Id, action);
            using var unknown = await PostAsync(client, manager.AccessToken, Guid.NewGuid(), action);

            asAdmin.StatusCode.ShouldBe(HttpStatusCode.Forbidden, action);
            anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized, action);
            unknown.StatusCode.ShouldBe(HttpStatusCode.NotFound, action);
            (await ProblemJson.ReadAsync(unknown, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("users.not-found");
        }

        (await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.Id)).GetProperty("status").GetString().ShouldBe("active");
    }

    private async Task<int> CountAuditAsync(Guid id, string action)
    {
        await using var context = database.CreateContext();
        var key = id.ToString("D");
        return await context.AuditLog.AsNoTracking().CountAsync(entry => entry.TargetId == key && entry.Action == action, TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> PostAsync(HttpClient client, string? accessToken, Guid id, string action)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, $"{UserFixtures.Route}/{id:D}/{action}", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
