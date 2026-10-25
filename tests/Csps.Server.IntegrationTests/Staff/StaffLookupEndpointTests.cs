using System.Data.SqlTypes;
using System.Net;
using System.Text.Json;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Users;
using Csps.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Staff;

/// <summary>CEXP-05, D-32, T-06-01, T-06-04, CWE-200, CWE-862: both roles read the staff who can pay, names and ids only; a stranger is refused.</summary>
public sealed class StaffLookupEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/staff";

    private static readonly string[] Keys = ["id", "name"];

    [Fact]
    public async Task AManagerReadsTheActiveSetUpStaffSortedByFirstNameLastNameAndId()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var caller = await TestSessions.StartAsync(factory, Roles.Manager);
        var seed = await SeedAsync(factory);

        var items = await ReadAsync(client, caller.AccessToken);

        var listed = items.Where(item => seed.CanPay.Contains(item.Id)).ToList();
        listed.Select(item => item.Id).ShouldBe(seed.ExpectedOrder);
        listed.Select(item => item.Name).ShouldBe(seed.ExpectedNames);
        items.Select(item => item.Id).ShouldNotContain(id => seed.CannotPay.Contains(id));
    }

    [Fact]
    public async Task AnAdminReadsTheSameList()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var caller = await TestSessions.StartAsync(factory, Roles.Admin);
        var seed = await SeedAsync(factory);

        var items = await ReadAsync(client, caller.AccessToken);

        items.Where(item => seed.CanPay.Contains(item.Id)).Select(item => item.Id).ShouldBe(seed.ExpectedOrder);
        items.Select(item => item.Id).ShouldNotContain(id => seed.CannotPay.Contains(id));
    }

    [Fact]
    public async Task TheCallerIsAlwaysInTheList()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var caller = await TestSessions.StartAsync(factory, Roles.Admin);

        var items = await ReadAsync(client, caller.AccessToken);

        items.ShouldNotBeEmpty();
        items.Select(item => item.Id).ShouldContain(caller.UserId);
    }

    [Fact]
    public async Task EachItemHoldsOnlyAnIdAndAName()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var caller = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await GetAsync(client, caller.AccessToken);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        document.RootElement.EnumerateArray().ShouldNotBeEmpty();
        document.RootElement.EnumerateArray()
            .ShouldAllBe(item => item.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal).SequenceEqual(Keys));
        body.ShouldNotContain("email", Case.Insensitive);
        body.ShouldNotContain("example.com", Case.Insensitive);
    }

    [Fact]
    public async Task ATemporaryPasswordPersonWhoHasNotSignedInIsListed()
    {
        // A-06-01 pin: the built rule is "has a password" (option 2). Choosing option 1 or 3 flips exactly this case.
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = await UserFixtures.CreateWithTemporaryPasswordAsync(
            client, manager.AccessToken, $"tia.{Guid.NewGuid():N}@example.com", $"Tmp-{Guid.NewGuid():N}!x");

        var items = await ReadAsync(client, manager.AccessToken);

        items.Select(item => item.Id).ShouldContain(id);
    }

    [Fact]
    public async Task TheListAndThePayerStateAgreeForEveryPerson()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var caller = await TestSessions.StartAsync(factory, Roles.Manager);
        var seed = await SeedAsync(factory);
        var temporaryId = await UserFixtures.CreateWithTemporaryPasswordAsync(
            client, caller.AccessToken, $"tia.{Guid.NewGuid():N}@example.com", $"Tmp-{Guid.NewGuid():N}!x");
        var everyone = seed.CanPay.Concat(seed.CannotPay).Append(temporaryId).Append(caller.UserId).ToList();

        var listed = (await ReadAsync(client, caller.AccessToken)).Select(item => item.Id).ToHashSet();

        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var directory = scope.ServiceProvider.GetRequiredService<IStaffDirectory>();
            foreach (var id in everyone)
            {
                var state = (await directory.GetStaffStateAsync(id, TestContext.Current.CancellationToken)).ShouldNotBeNull();
                state.CanPay.ShouldBe(listed.Contains(id), $"CanPay and the list disagree for {state.Name}");
            }

            (await directory.GetStaffStateAsync(Guid.NewGuid(), TestContext.Current.CancellationToken)).ShouldBeNull();
        }
    }

    [Fact]
    public async Task APayerStateCarriesTheRoleAndTheFlags()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var tag = UserFixtures.NewTag();
        var admin = await UserFixtures.CreateAsync(factory, tag, "Bea", "Bautista", Roles.Admin);
        var invited = await UserFixtures.CreateAsync(factory, tag, "Hal", "Honrado", Roles.Admin, withPassword: false);
        var locked = await UserFixtures.CreateAsync(factory, tag, "Gina", "Garcia");
        var deleted = await UserFixtures.CreateAsync(factory, tag, "Jun", "Javier", Roles.Admin);
        await AuthClient.DeactivateAsync(factory, admin.Id);
        await AccountStateFixtures.ManagerLockAsync(factory, locked.Id);
        await AccountStateFixtures.MarkDeletedAsync(factory, deleted.Id);

        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var directory = scope.ServiceProvider.GetRequiredService<IStaffDirectory>();
            var deactivated = (await directory.GetStaffStateAsync(admin.Id, TestContext.Current.CancellationToken)).ShouldNotBeNull();
            var noPassword = (await directory.GetStaffStateAsync(invited.Id, TestContext.Current.CancellationToken)).ShouldNotBeNull();
            var managerLocked = (await directory.GetStaffStateAsync(locked.Id, TestContext.Current.CancellationToken)).ShouldNotBeNull();
            var gone = (await directory.GetStaffStateAsync(deleted.Id, TestContext.Current.CancellationToken)).ShouldNotBeNull();

            (deactivated.Role, deactivated.IsActive, deactivated.HasPassword, deactivated.Name)
                .ShouldBe((Roles.Admin, false, true, $"Bea{tag} Bautista{tag}"));
            (noPassword.HasPassword, noPassword.IsActive).ShouldBe((false, true));
            (managerLocked.Role, managerLocked.IsManagerLocked, managerLocked.IsManager).ShouldBe((Roles.Manager, true, true));
            gone.IsDeleted.ShouldBeTrue();
        }
    }

    [Fact]
    public async Task AnAnonymousCallerGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await GetAsync(client, null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    private static Task<HttpResponseMessage> GetAsync(HttpClient client, string? accessToken) =>
        client.SendAsync(ApiRequests.Get(Route, accessToken), TestContext.Current.CancellationToken);

    private static async Task<IReadOnlyList<Listed>> ReadAsync(HttpClient client, string accessToken)
    {
        using var response = await GetAsync(client, accessToken);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, body);
        using var document = JsonDocument.Parse(body);
        return
        [
            .. document.RootElement.EnumerateArray()
                .Select(item => new Listed(item.GetProperty("id").GetGuid(), item.GetProperty("name").GetString() ?? string.Empty)),
        ];
    }

    // Five people who can pay (two Managers, three Admins; two share a name and their first names do not sort in insertion order)
    // and four who cannot: deactivated, Manager-locked, deleted, and invited with no password.
    private static async Task<Seed> SeedAsync(CspsApiFactory factory)
    {
        var tag = UserFixtures.NewTag();
        var mina = await UserFixtures.CreateAsync(factory, tag, "Mina", "Mercado");
        var abel = await UserFixtures.CreateAsync(factory, tag, "Abel", "Aquino");
        var zed = await UserFixtures.CreateAsync(factory, tag, "Zed", "Zamora", Roles.Admin);
        var dupA = await UserFixtures.CreateAsync(factory, tag, "Dup", "Same", Roles.Admin);
        var dupB = await UserFixtures.CreateAsync(factory, tag, "Dup", "Same", Roles.Admin);
        var deactivated = await UserFixtures.CreateAsync(factory, tag, "Dee", "Dizon", Roles.Admin);
        var locked = await UserFixtures.CreateAsync(factory, tag, "Gina", "Garcia");
        var deleted = await UserFixtures.CreateAsync(factory, tag, "Jun", "Javier", Roles.Admin);
        var invited = await UserFixtures.CreateAsync(factory, tag, "Hal", "Honrado", Roles.Admin, withPassword: false);

        await AuthClient.DeactivateAsync(factory, deactivated.Id);
        await AccountStateFixtures.ManagerLockAsync(factory, locked.Id);
        await AccountStateFixtures.MarkDeletedAsync(factory, deleted.Id);

        SeededUser[] canPay = [mina, abel, zed, dupA, dupB];
        var ordered = canPay
            .OrderBy(user => user.FirstName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(user => user.LastName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(user => new SqlGuid(user.Id))
            .ToList();
        return new Seed(
            [.. canPay.Select(user => user.Id)],
            [deactivated.Id, locked.Id, deleted.Id, invited.Id],
            [.. ordered.Select(user => user.Id)],
            [.. ordered.Select(user => $"{user.FirstName} {user.LastName}")]);
    }

    private sealed record Listed(Guid Id, string Name);

    private sealed record Seed(
        IReadOnlyList<Guid> CanPay, IReadOnlyList<Guid> CannotPay, IReadOnlyList<Guid> ExpectedOrder, IReadOnlyList<string> ExpectedNames);
}
