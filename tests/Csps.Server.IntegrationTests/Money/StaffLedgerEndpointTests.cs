using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Money;

/// <summary>MONEY-02, D-41: a staff member reads their own money rows newest first, each with the balance after it, all computed on the server.</summary>
public sealed class StaffLedgerEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly October3 = new(2026, 10, 3);
    private static readonly DateOnly October4 = new(2026, 10, 4);
    private static readonly DateOnly October5 = new(2026, 10, 5);

    [Fact]
    public async Task LizasThreeRowsComeNewestFirstEachWithTheBalanceAfterIt()
    {
        await using var world = await StartWorldAsync();

        var body = await MoneyFixtures.ReadLedgerAsync(world.Client, world.Liza.AccessToken);

        var items = body.GetProperty("items").EnumerateArray().ToList();
        items.Select(item => item.GetProperty("kind").GetString()).ShouldBe(["transfer-in", "company-expense", "payment-received"]);
        items.Select(item => item.GetProperty("date").GetString()).ShouldBe(["2026-10-05", "2026-10-04", "2026-10-03"]);
        items.Select(item => item.GetProperty("balanceAfter").GetDecimal()).ShouldBe([1200.00m, 700.00m, 1000.00m]);
        body.GetProperty("total").GetInt32().ShouldBe(3);
        body.GetProperty("page").GetInt32().ShouldBe(1);
        body.GetProperty("pageSize").GetInt32().ShouldBe(20);
        body.GetProperty("balance").GetDecimal().ShouldBe(1200.00m);
        body.GetProperty("includesDeleted").GetBoolean().ShouldBeFalse();

        var transfer = items[0];
        transfer.GetProperty("moneyIn").GetDecimal().ShouldBe(500.00m);
        transfer.GetProperty("moneyOut").ValueKind.ShouldBe(JsonValueKind.Null);
        transfer.GetProperty("counterpart").GetProperty("id").GetGuid().ShouldBe(world.Carmen.UserId);
        transfer.GetProperty("counterpart").GetProperty("name").GetString().ShouldBe("Carmen Reyes");
        transfer.GetProperty("transferId").GetGuid().ShouldNotBe(Guid.Empty);
        transfer.GetProperty("version").GetString().ShouldNotBeNullOrEmpty();

        var expense = items[1];
        expense.GetProperty("moneyOut").GetDecimal().ShouldBe(300.00m);
        expense.GetProperty("moneyIn").ValueKind.ShouldBe(JsonValueKind.Null);

        var payment = items[2];
        payment.GetProperty("moneyIn").GetDecimal().ShouldBe(1000.00m);
        payment.GetProperty("orderNumber").GetString().ShouldBe("ORD-2026-0001");
    }

    [Fact]
    public async Task TheNewestRowsBalanceAfterEqualsTheBalanceOnTheMoneyRoute()
    {
        await using var world = await StartWorldAsync();

        var body = await MoneyFixtures.ReadLedgerAsync(world.Client, world.Liza.AccessToken);

        var newest = body.GetProperty("items")[0].GetProperty("balanceAfter").GetDecimal();
        newest.ShouldBe(await MoneyFixtures.ReadBalanceAsync(world.Client, world.Liza.AccessToken));
    }

    [Fact]
    public async Task CarmensLedgerShowsTheSameTransferAsATransferOut()
    {
        await using var world = await StartWorldAsync();

        var body = await MoneyFixtures.ReadLedgerAsync(world.Client, world.Carmen.AccessToken);

        var newest = body.GetProperty("items")[0];
        newest.GetProperty("kind").GetString().ShouldBe("transfer-out");
        newest.GetProperty("moneyOut").GetDecimal().ShouldBe(500.00m);
        newest.GetProperty("moneyIn").ValueKind.ShouldBe(JsonValueKind.Null);
        newest.GetProperty("counterpart").GetProperty("id").GetGuid().ShouldBe(world.Liza.UserId);
        newest.GetProperty("balanceAfter").GetDecimal().ShouldBe(1500.00m);
        body.GetProperty("balance").GetDecimal().ShouldBe(1500.00m);
    }

    [Fact]
    public async Task AnAnonymousCallerGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await MoneyFixtures.GetLedgerAsync(client, null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    // Carmen (Manager) holds 2,000.00. Liza (Admin) is paid 1,000.00 on Oct 3, pays a 300.00 company expense on Oct 4, and gets 500.00 from Carmen on Oct 5.
    private async Task<World> StartWorldAsync()
    {
        await database.ResetAsync();
        var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        await MoneyFixtures.SeedPaymentAsync(database, liza.UserId, "ORD-2026-0001", 1000.00m, October3, Now);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0002", 2000.00m, October3, Now);
        await MoneyFixtures.SeedCompanyExpenseAsync(database, liza.UserId, liza.UserId, 300.00m, October4, Now);
        using var posted = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 500.00m, October5, "Cash for the fabric run");
        posted.StatusCode.ShouldBe(HttpStatusCode.Created, await posted.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return new World(factory, client, carmen, liza);
    }

    private sealed class World(CspsApiFactory factory, HttpClient client, StartedSession carmen, StartedSession liza) : IAsyncDisposable
    {
        public HttpClient Client { get; } = client;

        public StartedSession Carmen { get; } = carmen;

        public StartedSession Liza { get; } = liza;

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await factory.DisposeAsync();
        }
    }
}
