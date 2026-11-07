using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Money;

/// <summary>D-19, D-49, D-56: the transfer window offers exactly the people the server accepts, and the list carries no figure for anyone.</summary>
public sealed class TransferRecipientsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AManagerSeesEveryActiveAdminAndManagerThenTheOwedLeaversAndNobodyElse()
    {
        await using var world = await StartWorldAsync();

        var (status, people, _) = await ReadAsync(world.Client, world.Carmen.AccessToken);

        status.ShouldBe(HttpStatusCode.OK);
        people.ShouldBe(
        [
            new Recipient(world.Carmen.UserId, "Carmen Reyes", "active", true),
            new Recipient(world.Liza.UserId, "Liza Mercado", "active", false),
            new Recipient(world.Paolo.UserId, "Paolo Garcia", "active", false),
            new Recipient(world.Rico.UserId, "Rico Dela Cruz", "active", false),
            new Recipient(world.Jomar.UserId, "Jomar Santos", "deactivated", false),
        ]);
    }

    [Fact]
    public async Task ADeactivatedOrDeletedPersonAtZeroOrAboveAndTheNonStaffAccountsNeverAppear()
    {
        await using var world = await StartWorldAsync();

        var (status, people, _) = await ReadAsync(world.Client, world.Carmen.AccessToken);

        status.ShouldBe(HttpStatusCode.OK);
        var ids = people.Select(person => person.Id).ToList();
        ids.ShouldNotContain(world.Ana);
        ids.ShouldNotContain(world.Ben);
        ids.ShouldNotContain(world.Roleless);
        ids.ShouldNotContain(LegacyHolder.Id);
    }

    [Fact]
    public async Task AnAdminSeesTheSamePeopleWithThemselvesMarkedAsYou()
    {
        await using var world = await StartWorldAsync();

        var (status, people, _) = await ReadAsync(world.Client, world.Liza.AccessToken);

        status.ShouldBe(HttpStatusCode.OK);
        people.Select(person => person.Id).ShouldBe([world.Carmen.UserId, world.Liza.UserId, world.Paolo.UserId, world.Rico.UserId, world.Jomar.UserId]);
        people.Where(person => person.IsYou).Select(person => person.Id).ShouldBe([world.Liza.UserId]);
    }

    [Fact]
    public async Task NoEntryCarriesAnyNumberOrFigure()
    {
        await using var world = await StartWorldAsync();

        var (status, _, text) = await ReadAsync(world.Client, world.Carmen.AccessToken);

        status.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        foreach (var entry in document.RootElement.EnumerateArray())
        {
            entry.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal).ShouldBe(["id", "isYou", "name", "status"]);
            entry.EnumerateObject().ShouldAllBe(property => property.Value.ValueKind != JsonValueKind.Number);
        }

        text.ShouldNotContain("balance", Case.Insensitive);
        text.ShouldNotContain("amount", Case.Insensitive);
        text.ShouldNotContain("owed", Case.Insensitive);
    }

    [Fact]
    public async Task APersonOwedMoneyWhoWasDeletedReadsAsDeleted()
    {
        await using var world = await StartWorldAsync();
        await MoneyFixtures.DeleteAccountAsync(database, world.Jomar.UserId, Now);

        var (status, people, _) = await ReadAsync(world.Client, world.Carmen.AccessToken);

        status.ShouldBe(HttpStatusCode.OK);
        people.Last().ShouldBe(new Recipient(world.Jomar.UserId, "Jomar Santos", "deleted", false));
    }

    [Fact]
    public async Task PeopleAreSortedByFirstNameThenLastNameAndOwedLeaversSortAmongThemselves()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var today = await ExpenseFixtures.TodayAsync(factory);
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var anaMaria = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Ana Maria", "Cruz");
        var ana = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Ana", "Reyes");
        var jomar = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Jomar", "Santos");
        var bea = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Bea", "Navarro");
        foreach (var leaver in new[] { jomar, bea })
        {
            await MoneyFixtures.SeedCompanyExpenseAsync(database, leaver.UserId, leaver.UserId, 100.00m, today, Now);
            await MoneyFixtures.DeactivateAccountAsync(database, leaver.UserId);
        }

        var (status, people, _) = await ReadAsync(client, carmen.AccessToken);

        status.ShouldBe(HttpStatusCode.OK);
        people.Select(person => person.Name).ShouldBe(["Ana Reyes", "Ana Maria Cruz", "Carmen Reyes", "Bea Navarro", "Jomar Santos"]);
        people.Select(person => person.Id).ShouldBe([ana.UserId, anaMaria.UserId, carmen.UserId, bea.UserId, jomar.UserId]);
    }

    [Fact]
    public async Task AnAnonymousCallGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await MoneyFixtures.GetRecipientsAsync(client, null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task TheAnswerIsNeverCached()
    {
        await using var world = await StartWorldAsync();

        using var response = await MoneyFixtures.GetRecipientsAsync(world.Client, world.Carmen.AccessToken);

        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
    }

    private static async Task<(HttpStatusCode Status, List<Recipient> People, string Text)> ReadAsync(HttpClient client, string token)
    {
        using var response = await MoneyFixtures.GetRecipientsAsync(client, token);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        if (response.StatusCode != HttpStatusCode.OK)
        {
            return (response.StatusCode, [], text);
        }

        using var document = JsonDocument.Parse(text);
        var people = document.RootElement.EnumerateArray().Select(entry => new Recipient(
            entry.GetProperty("id").GetGuid(),
            entry.GetProperty("name").GetString() ?? string.Empty,
            entry.GetProperty("status").GetString() ?? string.Empty,
            entry.GetProperty("isYou").GetBoolean())).ToList();
        return (response.StatusCode, people, text);
    }

    // Carmen (Manager, signed in), Liza (Admin), Paolo (Admin, locked), Rico (Admin, invite not finished), Jomar (deactivated, owed 500.00),
    // Ana (deleted, 0.00), Ben (deactivated, holds 300.00), a role-less account and the legacy holder with the Admin role.
    private async Task<World> StartWorldAsync()
    {
        await database.ResetAsync();
        var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var client = factory.CreateClient();
        var today = await ExpenseFixtures.TodayAsync(factory);
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var paolo = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Paolo", "Garcia");
        var rico = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Rico", "Dela Cruz");
        var jomar = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Jomar", "Santos");
        var ana = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Ana", "Abad");
        var ben = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Ben", "Lim");
        var roleless = await OrderSeeding.AddStaffAsync(database, "Noel", Now, "Abad");
        await MoneyFixtures.AddRoleAsync(database, LegacyHolder.Id, Roles.Admin);
        await MoneyFixtures.LockAccountAsync(database, paolo.UserId, Now);
        await MoneyFixtures.MakeNotSetUpAsync(database, rico.UserId);
        await MoneyFixtures.SeedCompanyExpenseAsync(database, jomar.UserId, jomar.UserId, 500.00m, today, Now);
        await MoneyFixtures.SeedPaymentAsync(database, ben.UserId, "ORD-2026-0001", 300.00m, today, Now);
        await MoneyFixtures.DeactivateAccountAsync(database, jomar.UserId);
        await MoneyFixtures.DeleteAccountAsync(database, ana.UserId, Now);
        await MoneyFixtures.DeactivateAccountAsync(database, ben.UserId);
        return new World(factory, client, carmen, liza, paolo, rico, jomar, ana.UserId, ben.UserId, roleless);
    }

    private sealed record Recipient(Guid Id, string Name, string Status, bool IsYou);

    private sealed record World(
        CspsApiFactory Factory,
        HttpClient Client,
        StartedSession Carmen,
        StartedSession Liza,
        StartedSession Paolo,
        StartedSession Rico,
        StartedSession Jomar,
        Guid Ana,
        Guid Ben,
        Guid Roleless) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await Factory.DisposeAsync();
        }
    }
}
