using System.Net;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Users;

/// <summary>
/// USER-04, D-18, D-19, T-05-60, T-05-70: the shop is never left without an active Manager, even when two Managers deactivate, lock or
/// delete each other at the same moment, and nobody acts on their own account. An active Manager is role Manager, active, not deleted and not
/// Manager-locked; a failed-password lockout does not count against them.
/// </summary>
public sealed class LastManagerGuardTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string LastManagerCode = "users.last-active-manager";
    private const string LastManagerMessage = "You can't remove the last active Manager.";
    private const string OwnAccountCode = "users.own-account";
    private const string OwnAccountMessage = "You can't do this to your own account.";

    [Fact]
    public async Task AManagerDeactivatesAnotherManagerWhileOneRemainsAndAnAdminIsNeverCounted()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var a = await TestSessions.StartAsync(factory, Roles.Manager);
        var b = await TestSessions.StartAsync(factory, Roles.Manager);
        var c = await TestSessions.StartAsync(factory, Roles.Admin);

        using (var deactivated = await UserFixtures.ActionAsync(client, a.AccessToken, b.UserId, "deactivate"))
        {
            deactivated.StatusCode.ShouldBe(HttpStatusCode.NoContent, await deactivated.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        // An Admin is not a Manager, so removing one never needs another Manager to remain.
        using (var admin = await UserFixtures.ActionAsync(client, a.AccessToken, c.UserId, "deactivate"))
        {
            admin.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        (await ActiveManagersAsync()).ShouldBe([a.UserId]);
    }

    [Fact]
    public async Task ACallerWhoIsNotAnActiveManagerDoesNotCountSoTheOnlyOtherManagerCannotBeRemoved()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var a = await TestSessions.StartAsync(factory, Roles.Manager);
        var b = await TestSessions.StartAsync(factory, Roles.Manager);
        await AccountStateFixtures.ManagerLockAsync(factory, a.UserId);

        using var response = await UserFixtures.ActionAsync(client, a.AccessToken, b.UserId, "deactivate");

        await AssertRefusedAsync(response, LastManagerCode, LastManagerMessage);
        (await ActiveManagersAsync()).ShouldBe([b.UserId]);
    }

    [Fact]
    public async Task AFailedPasswordLockoutStillCountsAsAnActiveManager()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var a = await TestSessions.StartAsync(factory, Roles.Manager);
        var b = await TestSessions.StartAsync(factory, Roles.Manager);
        await AuthClient.LockAsync(factory, a.UserId);

        using var response = await UserFixtures.ActionAsync(client, a.AccessToken, b.UserId, "deactivate");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await ActiveManagersAsync()).ShouldBe([a.UserId]);
    }

    [Theory]
    [InlineData("deactivate")]
    [InlineData("activate")]
    [InlineData("lock")]
    public async Task AManagerActingOnTheirOwnAccountIsRefusedAndNothingChanges(string action)
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var a = await TestSessions.StartAsync(factory, Roles.Manager);
        var b = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await UserFixtures.ActionAsync(client, a.AccessToken, a.UserId, action);

        await AssertRefusedAsync(response, OwnAccountCode, OwnAccountMessage);
        (await ActiveManagersAsync()).Order().ShouldBe(new[] { a.UserId, b.UserId }.Order());
        (await UserFixtures.ReadDetailAsync(client, a.AccessToken, a.UserId)).GetProperty("status").GetString().ShouldBe("active");
    }

    [Fact]
    public async Task TwoManagersDeactivatingEachOtherTogetherLeaveExactlyOneActiveEveryTime()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        for (var run = 0; run < 20; run++)
        {
            // Each run starts from an empty roster, so the one survivor is the only active Manager.
            await database.ResetAsync();
            var a = await TestSessions.StartAsync(factory, Roles.Manager);
            var b = await TestSessions.StartAsync(factory, Roles.Manager);

            // A warm session cache keeps the loser's token valid until the winner's eviction, so the 422 comes from the guard.
            (await AuthClient.SiteSettingsStatusAsync(client, a.AccessToken)).ShouldBe(HttpStatusCode.OK, $"run {run}");
            (await AuthClient.SiteSettingsStatusAsync(client, b.AccessToken)).ShouldBe(HttpStatusCode.OK, $"run {run}");

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => UserFixtures.ActionAsync(client, a.AccessToken, b.UserId, "deactivate"),
                () => UserFixtures.ActionAsync(client, b.AccessToken, a.UserId, "deactivate"));
            using (first)
            using (second)
            {
                new[] { first.StatusCode, second.StatusCode }.Order().ToArray()
                    .ShouldBe([HttpStatusCode.NoContent, HttpStatusCode.UnprocessableEntity], $"run {run}");
                var loser = first.StatusCode == HttpStatusCode.UnprocessableEntity ? first : second;
                (await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe(LastManagerCode, $"run {run}");
            }

            (await ActiveManagersAsync()).Count.ShouldBe(1, $"run {run}");
        }
    }

    [Fact]
    public async Task AManagerLocksAnotherManagerWhileOneRemainsAndUnlockingBringsThemBack()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var a = await TestSessions.StartAsync(factory, Roles.Manager);
        var b = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);

        using (var locked = await UserFixtures.ActionAsync(client, a.AccessToken, b.UserId, "lock"))
        {
            locked.StatusCode.ShouldBe(HttpStatusCode.NoContent, await locked.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        // An Admin is not a Manager, so locking one never needs another Manager to remain.
        using (var adminLocked = await UserFixtures.ActionAsync(client, a.AccessToken, admin.UserId, "lock"))
        {
            adminLocked.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        (await ActiveManagersAsync()).ShouldBe([a.UserId]);
        using (var unlocked = await UserFixtures.ActionAsync(client, a.AccessToken, b.UserId, "unlock"))
        {
            unlocked.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        (await ActiveManagersAsync()).Order().ShouldBe(new[] { a.UserId, b.UserId }.Order());
    }

    [Fact]
    public async Task LockingTheLastActiveManagerIsRefusedAndNothingChanges()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var a = await TestSessions.StartAsync(factory, Roles.Manager);
        var b = await TestSessions.StartAsync(factory, Roles.Manager);
        await AuthClient.DeactivateAsync(factory, a.UserId);

        // The caller is no longer an active Manager, so b is the only one left.
        using var response = await UserFixtures.ActionAsync(client, a.AccessToken, b.UserId, "lock");

        await AssertRefusedAsync(response, LastManagerCode, LastManagerMessage);
        (await ActiveManagersAsync()).ShouldBe([b.UserId]);
    }

    [Fact]
    public async Task TwoManagersLockingEachOtherTogetherLeaveExactlyOneActiveEveryTime()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        for (var run = 0; run < 20; run++)
        {
            await database.ResetAsync();
            var a = await TestSessions.StartAsync(factory, Roles.Manager);
            var b = await TestSessions.StartAsync(factory, Roles.Manager);
            (await AuthClient.SiteSettingsStatusAsync(client, a.AccessToken)).ShouldBe(HttpStatusCode.OK, $"run {run}");
            (await AuthClient.SiteSettingsStatusAsync(client, b.AccessToken)).ShouldBe(HttpStatusCode.OK, $"run {run}");

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => UserFixtures.ActionAsync(client, a.AccessToken, b.UserId, "lock"),
                () => UserFixtures.ActionAsync(client, b.AccessToken, a.UserId, "lock"));
            using (first)
            using (second)
            {
                new[] { first.StatusCode, second.StatusCode }.Order().ToArray()
                    .ShouldBe([HttpStatusCode.NoContent, HttpStatusCode.UnprocessableEntity], $"run {run}");
                var loser = first.StatusCode == HttpStatusCode.UnprocessableEntity ? first : second;
                (await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe(LastManagerCode, $"run {run}");
            }

            (await ActiveManagersAsync()).Count.ShouldBe(1, $"run {run}");
        }
    }

    [Fact]
    public async Task ALockAndADeactivateOnTheTwoManagersAtTheSameTimeLeaveExactlyOneActive()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        for (var run = 0; run < 10; run++)
        {
            await database.ResetAsync();
            var a = await TestSessions.StartAsync(factory, Roles.Manager);
            var b = await TestSessions.StartAsync(factory, Roles.Manager);
            (await AuthClient.SiteSettingsStatusAsync(client, a.AccessToken)).ShouldBe(HttpStatusCode.OK, $"run {run}");
            (await AuthClient.SiteSettingsStatusAsync(client, b.AccessToken)).ShouldBe(HttpStatusCode.OK, $"run {run}");

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => UserFixtures.ActionAsync(client, a.AccessToken, b.UserId, "lock"),
                () => UserFixtures.ActionAsync(client, b.AccessToken, a.UserId, "deactivate"));
            using (first)
            using (second)
            {
                new[] { first.StatusCode, second.StatusCode }.Order().ToArray()
                    .ShouldBe([HttpStatusCode.NoContent, HttpStatusCode.UnprocessableEntity], $"run {run}");
            }

            (await ActiveManagersAsync()).Count.ShouldBe(1, $"run {run}");
        }
    }

    [Fact]
    public async Task AManagerDeletesAnotherManagerWhileOneRemainsAndAnAdminIsNeverCounted()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var a = await TestSessions.StartAsync(factory, Roles.Manager);
        var b = await TestSessions.StartAsync(factory, Roles.Manager);
        var c = await TestSessions.StartAsync(factory, Roles.Admin);

        using (var deleted = await UserFixtures.DeleteAsync(client, a.AccessToken, b.UserId))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent, await deleted.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        // An Admin is not a Manager, so deleting one never needs another Manager to remain.
        using (var admin = await UserFixtures.DeleteAsync(client, a.AccessToken, c.UserId))
        {
            admin.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        (await ActiveManagersAsync()).ShouldBe([a.UserId]);
    }

    [Fact]
    public async Task DeletingTheLastActiveManagerIsRefusedAndNothingChanges()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var a = await TestSessions.StartAsync(factory, Roles.Manager);
        var b = await TestSessions.StartAsync(factory, Roles.Manager);
        await AccountStateFixtures.ManagerLockAsync(factory, a.UserId);

        // The caller is Manager-locked, so b is the only active Manager left.
        using var response = await UserFixtures.DeleteAsync(client, a.AccessToken, b.UserId);

        await AssertRefusedAsync(response, LastManagerCode, LastManagerMessage);
        (await ActiveManagersAsync()).ShouldBe([b.UserId]);
        (await UserFixtures.ReadDetailAsync(client, b.AccessToken, b.UserId)).GetProperty("status").GetString().ShouldBe("active");
    }

    [Fact]
    public async Task AManagerDeletingTheirOwnAccountIsRefusedAndNothingChanges()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var a = await TestSessions.StartAsync(factory, Roles.Manager);
        var b = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await UserFixtures.DeleteAsync(client, a.AccessToken, a.UserId);

        await AssertRefusedAsync(response, OwnAccountCode, OwnAccountMessage);
        (await ActiveManagersAsync()).Order().ShouldBe(new[] { a.UserId, b.UserId }.Order());
        (await UserFixtures.ReadDetailAsync(client, a.AccessToken, a.UserId)).GetProperty("status").GetString().ShouldBe("active");
    }

    [Fact]
    public async Task TwoManagersDeletingEachOtherTogetherLeaveExactlyOneActiveEveryTime()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        for (var run = 0; run < 20; run++)
        {
            await database.ResetAsync();
            var a = await TestSessions.StartAsync(factory, Roles.Manager);
            var b = await TestSessions.StartAsync(factory, Roles.Manager);
            (await AuthClient.SiteSettingsStatusAsync(client, a.AccessToken)).ShouldBe(HttpStatusCode.OK, $"run {run}");
            (await AuthClient.SiteSettingsStatusAsync(client, b.AccessToken)).ShouldBe(HttpStatusCode.OK, $"run {run}");

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => UserFixtures.DeleteAsync(client, a.AccessToken, b.UserId),
                () => UserFixtures.DeleteAsync(client, b.AccessToken, a.UserId));
            using (first)
            using (second)
            {
                new[] { first.StatusCode, second.StatusCode }.Order().ToArray()
                    .ShouldBe([HttpStatusCode.NoContent, HttpStatusCode.UnprocessableEntity], $"run {run}");
                var loser = first.StatusCode == HttpStatusCode.UnprocessableEntity ? first : second;
                (await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe(LastManagerCode, $"run {run}");
            }

            (await ActiveManagersAsync()).Count.ShouldBe(1, $"run {run}");
        }
    }

    private static async Task AssertRefusedAsync(HttpResponseMessage response, string code, string message)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe(code);
        problem.GetProperty("detail").GetString().ShouldBe(message);
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
}
