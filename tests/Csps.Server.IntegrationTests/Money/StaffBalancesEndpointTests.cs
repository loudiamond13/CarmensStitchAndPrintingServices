using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Money;

/// <summary>MONEY-03, D-42 to D-44, D-56: a Manager reads what every staff member holds, leavers who still hold or are owed money included, with the team total.</summary>
public sealed class StaffBalancesEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AManagerSeesActivePeopleByNameThenLeaversWithMoneyByNameAndTheTotal()
    {
        await using var world = await StartWorldAsync();

        var (status, body, text) = await ReadAsync(world.Client, world.Carmen.AccessToken);

        status.ShouldBe(HttpStatusCode.OK, text);
        body.Items.ShouldBe(
        [
            new Row(world.Carmen.UserId, "Carmen Reyes", "Manager", "active", 8450.00m, true),
            new Row(world.Liza.UserId, "Liza Mercado", "Admin", "active", -500.00m, false),
            new Row(world.Paolo.UserId, "Paolo Garcia", "Admin", "active", 0.00m, false),
            new Row(world.Ana, "Ana Abad", "Admin", "deleted", -300.00m, false),
            new Row(world.Jomar, "Jomar Santos", "Admin", "deactivated", 2000.00m, false),
        ]);
        body.Total.ShouldBe(9650.00m);
    }

    [Fact]
    public async Task ALeaverAtZeroTheLegacyHolderAndAnAccountWithNoRoleNeverAppear()
    {
        await using var world = await StartWorldAsync();

        var (status, body, text) = await ReadAsync(world.Client, world.Carmen.AccessToken);

        status.ShouldBe(HttpStatusCode.OK, text);
        var ids = body.Items.Select(row => row.UserId).ToList();
        ids.ShouldNotContain(world.Ben);
        ids.ShouldNotContain(world.Roleless);
        ids.ShouldNotContain(LegacyHolder.Id);
        text.ShouldNotContain("111.11");
    }

    [Fact]
    public async Task TheTotalIsTheSumOfTheListedBalancesEvenWhenItIsBelowZero()
    {
        await using var world = await StartWorldAsync();
        var today = await ExpenseFixtures.TodayAsync(world.Factory);
        await MoneyFixtures.SeedCompanyExpenseAsync(database, world.Carmen.UserId, world.Carmen.UserId, 20000.00m, today, Now);

        var (status, body, text) = await ReadAsync(world.Client, world.Carmen.AccessToken);

        status.ShouldBe(HttpStatusCode.OK, text);
        body.Items.Single(row => row.UserId == world.Carmen.UserId).Balance.ShouldBe(-11550.00m);
        body.Total.ShouldBe(-10350.00m);
        body.Total.ShouldBe(body.Items.Sum(row => row.Balance));
    }

    [Fact]
    public async Task WithOnlyOneManagerOnStaffTheAnswerIsOneRowAndTheTotalEqualsIt()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var today = await ExpenseFixtures.TodayAsync(factory);
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 125.50m, today, Now);

        var (status, body, text) = await ReadAsync(client, carmen.AccessToken);

        status.ShouldBe(HttpStatusCode.OK, text);
        body.Items.ShouldBe([new Row(carmen.UserId, "Carmen Reyes", "Manager", "active", 125.50m, true)]);
        body.Total.ShouldBe(125.50m);
    }

    [Fact]
    public async Task AnAdminGets403()
    {
        await using var world = await StartWorldAsync();

        using var response = await MoneyFixtures.GetStaffBalancesAsync(world.Client, world.Liza.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ProblemJson.ReadWithoutTraceIdAsync(response, TestContext.Current.CancellationToken)).ShouldNotContain("9650");
    }

    [Fact]
    public async Task AnAnonymousCallerGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await MoneyFixtures.GetStaffBalancesAsync(client, null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task TheAnswerIsNeverCached()
    {
        await using var world = await StartWorldAsync();

        using var response = await MoneyFixtures.GetStaffBalancesAsync(world.Client, world.Carmen.AccessToken);

        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
    }

    private static async Task<(HttpStatusCode Status, Balances Body, string Text)> ReadAsync(HttpClient client, string token)
    {
        using var response = await MoneyFixtures.GetStaffBalancesAsync(client, token);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        if (response.StatusCode != HttpStatusCode.OK)
        {
            return (response.StatusCode, new Balances([], 0m), text);
        }

        using var document = JsonDocument.Parse(text);
        var items = document.RootElement.GetProperty("items").EnumerateArray().Select(entry => new Row(
            entry.GetProperty("userId").GetGuid(),
            entry.GetProperty("name").GetString() ?? string.Empty,
            entry.GetProperty("role").GetString() ?? string.Empty,
            entry.GetProperty("status").GetString() ?? string.Empty,
            entry.GetProperty("balance").GetDecimal(),
            entry.GetProperty("isYou").GetBoolean())).ToList();
        return (response.StatusCode, new Balances(items, document.RootElement.GetProperty("total").GetDecimal()), text);
    }

    // Carmen (Manager, signed in) holds 8,450.00, Liza (Admin) is owed 500.00, Paolo (Admin, Manager-locked) holds 0.00, Jomar (deactivated)
    // holds 2,000.00, Ana (deleted) is owed 300.00, Ben (deactivated) holds 0.00, a role-less account and the legacy holder (Admin role,
    // 111.11 received) must stay out.
    private async Task<World> StartWorldAsync()
    {
        await database.ResetAsync();
        var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var client = factory.CreateClient();
        var today = await ExpenseFixtures.TodayAsync(factory);
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var paolo = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Paolo", "Garcia");
        var jomar = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Jomar", "Santos");
        var ana = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Ana", "Abad");
        var ben = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Ben", "Lim");
        var roleless = await OrderSeeding.AddStaffAsync(database, "Noel", Now, "Abad");
        await MoneyFixtures.AddRoleAsync(database, LegacyHolder.Id, Roles.Admin);
        await MoneyFixtures.LockAccountAsync(database, paolo.UserId, Now);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0001", 8450.00m, today, Now);
        await MoneyFixtures.SeedCompanyExpenseAsync(database, liza.UserId, liza.UserId, 500.00m, today, Now);
        await MoneyFixtures.SeedPaymentAsync(database, jomar.UserId, "ORD-2026-0002", 2000.00m, today, Now);
        await MoneyFixtures.SeedCompanyExpenseAsync(database, ana.UserId, ana.UserId, 300.00m, today, Now);
        await MoneyFixtures.SeedPaymentAsync(database, LegacyHolder.Id, "ORD-2026-0003", 111.11m, today, Now);
        await MoneyFixtures.DeactivateAccountAsync(database, jomar.UserId);
        await MoneyFixtures.DeleteAccountAsync(database, ana.UserId, Now);
        await MoneyFixtures.DeactivateAccountAsync(database, ben.UserId);
        return new World(factory, client, carmen, liza, paolo, jomar.UserId, ana.UserId, ben.UserId, roleless);
    }

    private sealed record Row(Guid UserId, string Name, string Role, string Status, decimal Balance, bool IsYou);

    private sealed record Balances(IReadOnlyList<Row> Items, decimal Total);

    private sealed record World(
        CspsApiFactory Factory,
        HttpClient Client,
        StartedSession Carmen,
        StartedSession Liza,
        StartedSession Paolo,
        Guid Jomar,
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
