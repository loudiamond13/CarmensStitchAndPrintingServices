using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-05, ORD-20, ORD-23, D-17, D-30, D-31: staff record what an order cost and who paid it, and the profit follows every change.</summary>
public sealed class OrderExpensesEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AnAdminRecordsAnExpensePaidByAManagerAndTheExpensesAndProfitUpdateWithTheBalanceUntouched()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await Ord0148WithDiscountAsync(client, manager.AccessToken, today);
        var id = order.GetProperty("id").GetGuid();

        using var response = await OrderFixtures.AddExpenseAsync(
            client,
            admin.AccessToken,
            id,
            OrderFixtures.ExpenseBody(today.AddDays(-5), OrderFixtures.FabricId, "Dri-fit mesh, 45 yds", 3825.00m, manager.UserId, order.GetProperty("version").GetString()));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var after = document.RootElement;
        var totals = after.GetProperty("totals");
        totals.GetProperty("total").GetDecimal().ShouldBe(21327.50m);
        totals.GetProperty("expenses").GetDecimal().ShouldBe(3825.00m);
        totals.GetProperty("profit").GetDecimal().ShouldBe(17502.50m);
        totals.GetProperty("balance").GetDecimal().ShouldBe(21327.50m);
        var expense = after.GetProperty("expenses").EnumerateArray().ShouldHaveSingleItem();
        expense.GetProperty("id").GetGuid().ShouldNotBe(Guid.Empty);
        expense.GetProperty("expenseDate").GetString().ShouldBe(OrderFixtures.Date(today.AddDays(-5)));
        expense.GetProperty("amount").GetDecimal().ShouldBe(3825.00m);
        expense.GetProperty("description").GetString().ShouldBe("Dri-fit mesh, 45 yds");
        var category = expense.GetProperty("category");
        category.GetProperty("id").GetGuid().ShouldBe(OrderFixtures.FabricId);
        category.GetProperty("name").GetString().ShouldBe("Fabric");
        category.GetProperty("tone").GetString().ShouldNotBeNullOrEmpty();
        category.GetProperty("retired").GetBoolean().ShouldBeFalse();
        expense.GetProperty("paidBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        expense.GetProperty("paidByActive").GetBoolean().ShouldBeTrue();
        expense.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        after.GetProperty("version").GetString().ShouldNotBe(order.GetProperty("version").GetString());
        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        read.GetProperty("expenses").GetArrayLength().ShouldBe(1);
        read.GetProperty("totals").GetProperty("profit").GetDecimal().ShouldBe(17502.50m);
    }

    [Fact]
    public async Task AnonymousIsRefusedWith401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await OrderFixtures.AddExpenseAsync(client, accessToken: null, Guid.NewGuid(), new Dictionary<string, object?>());

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AnUnknownOrderAnswers404WithTheOrderNotFoundCode()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));

        using var response = await OrderFixtures.AddExpenseAsync(
            client,
            manager.AccessToken,
            Guid.NewGuid(),
            OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, null, 100m, manager.UserId, created.GetProperty("version").GetString()));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.not-found");
    }

    private static async Task<JsonElement> Ord0148WithDiscountAsync(HttpClient client, string token, DateOnly today)
    {
        var created = await OrderFixtures.CreateAsync(client, token, OrderFixtures.Ord0148ItemsBody(today));
        return await OrderFixtures.AddDiscountAndReadAsync(client, token, created, "percentage", 5m);
    }
}
