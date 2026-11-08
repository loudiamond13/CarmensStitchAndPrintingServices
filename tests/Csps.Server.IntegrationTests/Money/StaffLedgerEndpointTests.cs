using System.Globalization;
using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Orders;
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

    [Fact]
    public async Task TheRunningBalanceHoldsAcrossPages()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var expected = await SeedTwentyFiveRowsAsync(liza.UserId);

        var first = await ReadItemsAsync(client, liza.AccessToken, "page=1&pageSize=10");
        var second = await ReadItemsAsync(client, liza.AccessToken, "page=2&pageSize=10");
        var third = await ReadItemsAsync(client, liza.AccessToken, "page=3&pageSize=10");

        first.Count.ShouldBe(10);
        second.Count.ShouldBe(10);
        third.Count.ShouldBe(5);
        var all = first.Concat(second).Concat(third).ToList();
        all.Select(item => item.GetProperty("date").GetString()).ShouldBe(expected.Select(row => row.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)));
        all.Select(item => item.GetProperty("balanceAfter").GetDecimal()).ShouldBe(expected.Select((_, index) => expected.Skip(index).Sum(row => row.Signed)));
        second[0].GetProperty("balanceAfter").GetDecimal().ShouldBe(first[^1].GetProperty("balanceAfter").GetDecimal() - Signed(first[^1]));
        third[^1].GetProperty("balanceAfter").GetDecimal().ShouldBe(Signed(third[^1]));
        first[0].GetProperty("balanceAfter").GetDecimal().ShouldBe(await MoneyFixtures.ReadBalanceAsync(client, liza.AccessToken));
    }

    [Fact]
    public async Task EveryKindCarriesItsDetails()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var jomar = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Jomar", "Santos");
        var orderId = await OrderSeeding.AddAsync(
            database,
            new SeedOrder("ORD-2026-0001", OrderStatus.Pending)
            {
                TeamName = "Davao Riders",
                Total = 5000.00m,
                Payments = [new SeedMoney(October3, 1000.00m)],
                Expenses = [new SeedMoney(new DateOnly(2026, 10, 6), 120.00m) { Description = "Sublimation paper" }],
            },
            liza.UserId,
            Now);
        var cancelledId = await OrderSeeding.AddAsync(
            database,
            new SeedOrder("ORD-2026-0002", OrderStatus.Cancelled) { Total = 900.00m, Payments = [new SeedMoney(October3, 500.00m)], Refunds = [new SeedMoney(new DateOnly(2026, 10, 7), 200.00m)] },
            liza.UserId,
            Now);
        await MoneyFixtures.SeedCompanyExpenseAsync(database, liza.UserId, liza.UserId, 300.00m, October4, Now);
        await MoneyFixtures.SeedPaymentAsync(database, carmen.UserId, "ORD-2026-0003", 2000.00m, October3, Now);
        await MoneyFixtures.SeedPaymentAsync(database, jomar.UserId, "ORD-2026-0004", 800.00m, October3, Now);
        using var transferred = await MoneyFixtures.PostTransferAsync(client, carmen.AccessToken, liza.UserId, 400.00m, new DateOnly(2026, 10, 8), "Cash for the fabric run");
        transferred.StatusCode.ShouldBe(HttpStatusCode.Created);
        await MoneyFixtures.DeleteAccountAsync(database, jomar.UserId, Now);
        using var handedOver = await MoneyFixtures.PostHandoverAsync(client, carmen.AccessToken, jomar.UserId, liza.UserId, 800.00m, new DateOnly(2026, 10, 9), "Closing his drawer");
        handedOver.StatusCode.ShouldBe(HttpStatusCode.Created, await handedOver.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

        var items = await ReadItemsAsync(client, liza.AccessToken, "pageSize=50");

        items.Select(item => item.GetProperty("kind").GetString()).Order(StringComparer.Ordinal).ShouldBe(
            ["company-expense", "order-expense", "payment-received", "payment-received", "refund-handed-back", "transfer-in", "transfer-in"]);
        var payment = items.Single(item => item.GetProperty("kind").GetString() == "payment-received" && item.GetProperty("orderNumber").GetString() == "ORD-2026-0001");
        payment.GetProperty("orderId").GetGuid().ShouldBe(orderId);
        payment.GetProperty("team").GetString().ShouldBe("Davao Riders");
        payment.GetProperty("customer").GetString().ShouldBe("Juan Dela Cruz");
        payment.GetProperty("paymentMethod").GetString().ShouldBe("Cash");

        var refund = items.Single(item => item.GetProperty("kind").GetString() == "refund-handed-back");
        refund.GetProperty("orderId").GetGuid().ShouldBe(cancelledId);
        refund.GetProperty("orderNumber").GetString().ShouldBe("ORD-2026-0002");
        refund.GetProperty("customer").GetString().ShouldBe("Juan Dela Cruz");
        refund.GetProperty("moneyOut").GetDecimal().ShouldBe(200.00m);

        var orderExpense = items.Single(item => item.GetProperty("kind").GetString() == "order-expense");
        orderExpense.GetProperty("orderId").GetGuid().ShouldBe(orderId);
        orderExpense.GetProperty("orderNumber").GetString().ShouldBe("ORD-2026-0001");
        orderExpense.GetProperty("category").GetString().ShouldBe("Fabric");
        orderExpense.GetProperty("description").GetString().ShouldBe("Sublimation paper");

        var companyExpense = items.Single(item => item.GetProperty("kind").GetString() == "company-expense");
        companyExpense.GetProperty("category").GetString().ShouldBe("Supplies");
        companyExpense.GetProperty("description").GetString().ShouldBe("Thread and needles");

        var transfer = items.Single(item => item.GetProperty("note").GetString() == "Cash for the fabric run");
        transfer.GetProperty("kind").GetString().ShouldBe("transfer-in");
        transfer.GetProperty("counterpart").GetProperty("name").GetString().ShouldBe("Carmen Reyes");
        transfer.GetProperty("counterpart").GetProperty("formerStaff").GetBoolean().ShouldBeFalse();
        transfer.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(carmen.UserId);
        transfer.GetProperty("transferId").GetGuid().ShouldNotBe(Guid.Empty);
        transfer.GetProperty("version").GetString().ShouldNotBeNullOrEmpty();
        transfer.GetProperty("isHandover").GetBoolean().ShouldBeFalse();
        transfer.GetProperty("isDeleted").GetBoolean().ShouldBeFalse();

        var handover = items.Single(item => item.GetProperty("note").GetString() == "Closing his drawer");
        handover.GetProperty("isHandover").GetBoolean().ShouldBeTrue();
        handover.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(carmen.UserId);
        handover.GetProperty("counterpart").GetProperty("name").GetString().ShouldBe("Jomar Santos");
        handover.GetProperty("counterpart").GetProperty("formerStaff").GetBoolean().ShouldBeTrue();
    }

    [Fact]
    public async Task APersonWithNoMoneyRowsGetsAnEmptyLedger()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");

        var body = await MoneyFixtures.ReadLedgerAsync(client, liza.AccessToken);

        body.GetProperty("items").GetArrayLength().ShouldBe(0);
        body.GetProperty("total").GetInt32().ShouldBe(0);
        body.GetProperty("balance").GetDecimal().ShouldBe(0.00m);
    }

    [Theory]
    [InlineData("pageSize=101", "pageSize", "Use a page size from 1 to 100.")]
    [InlineData("pageSize=0", "pageSize", "Use a page size from 1 to 100.")]
    [InlineData("page=0", "page", "Use a page from 1 to 100000.")]
    [InlineData("page=100001", "page", "Use a page from 1 to 100000.")]
    public async Task APageSizeOrPageOutOfRangeAnswers400WithTheSharedListMessage(string query, string field, string message)
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");

        using var response = await MoneyFixtures.GetLedgerAsync(client, liza.AccessToken, query);

        (await MoneyFixtures.ReadFieldErrorsAsync(response, field)).ShouldBe([message]);
    }

    [Theory]
    [InlineData("page=100000&pageSize=1")]
    [InlineData("page=1&pageSize=100")]
    public async Task TheLimitsThemselvesAreAccepted(string query)
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");

        using var response = await MoneyFixtures.GetLedgerAsync(client, liza.AccessToken, query);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    private static async Task<List<JsonElement>> ReadItemsAsync(HttpClient client, string accessToken, string query) =>
        [.. (await MoneyFixtures.ReadLedgerAsync(client, accessToken, query)).GetProperty("items").EnumerateArray()];

    private static decimal Signed(JsonElement item) =>
        item.GetProperty("moneyIn").ValueKind == JsonValueKind.Null ? -item.GetProperty("moneyOut").GetDecimal() : item.GetProperty("moneyIn").GetDecimal();

    // 25 rows on 25 different days (1 to 25 October): payments, company expenses and order expenses. Returned newest first.
    private async Task<List<(DateOnly Date, decimal Signed)>> SeedTwentyFiveRowsAsync(Guid personId)
    {
        var specs = Enumerable.Range(1, 25).Select(day => (Day: new DateOnly(2026, 10, day), Kind: day % 3, Amount: 20.25m + day)).ToList();
        await OrderSeeding.AddAsync(
            database,
            new SeedOrder("ORD-2026-0001", OrderStatus.Pending)
            {
                Total = 100000.00m,
                Payments = [.. specs.Where(spec => spec.Kind == 0).Select(spec => new SeedMoney(spec.Day, spec.Amount))],
                Expenses = [.. specs.Where(spec => spec.Kind == 2).Select(spec => new SeedMoney(spec.Day, spec.Amount))],
            },
            personId,
            Now);
        foreach (var spec in specs.Where(spec => spec.Kind == 1))
        {
            await MoneyFixtures.SeedCompanyExpenseAsync(database, personId, personId, spec.Amount, spec.Day, Now);
        }

        return [.. specs.OrderByDescending(spec => spec.Day).Select(spec => (spec.Day, spec.Kind == 0 ? spec.Amount : -spec.Amount))];
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
