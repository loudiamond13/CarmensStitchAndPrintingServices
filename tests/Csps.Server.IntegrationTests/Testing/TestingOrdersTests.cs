using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Orders;
using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;

namespace Csps.Server.IntegrationTests.Testing;

/// <summary>
/// ORD-21, D-37: <c>POST /api/testing/orders</c> lets Phase 8 end-to-end specs seed an order with a chosen number, status, items,
/// payments and expenses, in the Testing environment of a Debug build only. It goes through the legacy import handler, so the
/// figures are worked out by the server and the numbers are kept as given.
/// </summary>
public sealed class TestingOrdersTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/testing/orders";

    [Fact]
    public async Task APostImportsTheOrderAndTheReadShowsItsNumberStatusAndExactTotals()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);

        var id = await CreateAsync(client, Body("ORD-2026-0711", "production", today, admin.UserId));

        var read = await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id);
        read.GetProperty("number").GetString().ShouldBe("ORD-2026-0711");
        read.GetProperty("status").GetString().ShouldBe("production");
        read.GetProperty("customerName").GetString().ShouldBe("Juan Dela Cruz");
        var totals = read.GetProperty("totals");
        totals.GetProperty("subtotal").GetDecimal().ShouldBe(9750.00m);
        totals.GetProperty("total").GetDecimal().ShouldBe(9750.00m);
        totals.GetProperty("paid").GetDecimal().ShouldBe(5000.00m);
        totals.GetProperty("balance").GetDecimal().ShouldBe(4750.00m);
        read.GetProperty("items").GetArrayLength().ShouldBe(1);
        read.GetProperty("payments").EnumerateArray().ShouldHaveSingleItem()
            .GetProperty("receivedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
    }

    [Fact]
    public async Task AnyOfTheSevenStatusesCanBeSeededIncludingACompletedOrderWithABalance()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);

        var id = await CreateAsync(client, Body("ORD-2026-0712", "completed", today, admin.UserId));

        var read = await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id);
        read.GetProperty("status").GetString().ShouldBe("completed");
        read.GetProperty("totals").GetProperty("balance").GetDecimal().ShouldBe(4750.00m);
    }

    [Fact]
    public async Task ATakenNumberIs422OrdersNumberTaken()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        await CreateAsync(client, Body("ORD-2026-0713", "pending", today, admin.UserId));

        using var response = await client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), Body("ORD-2026-0713", "pending", today, admin.UserId), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.number-taken");
    }

    [Fact]
    public async Task NoBodyIs400()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.PostAsync(new Uri(Route, UriKind.Relative), null, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("status").GetInt32().ShouldBe(400);
    }

    [Fact]
    public async Task AnEmptyObjectIs400()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), new { }, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.ErrorFields(problem).ShouldNotBeEmpty();
    }

    [Fact]
    public async Task AnUnparseableBodyIs400()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var content = new StringContent("not json", Encoding.UTF8, "application/json");

        using var response = await client.PostAsync(new Uri(Route, UriKind.Relative), content, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Theory]
    [InlineData("""{"items":[null]}""", "items")]
    [InlineData("""{"discounts":[null]}""", "discounts")]
    [InlineData("""{"payments":[null]}""", "payments")]
    [InlineData("""{"expenses":[null]}""", "expenses")]
    public async Task ANullListMemberIs400OnItsListNotA500(string json, string field)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var content = new StringContent(json, Encoding.UTF8, "application/json");

        using var response = await client.PostAsync(new Uri(Route, UriKind.Relative), content, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.ErrorFields(problem).ShouldContain(field);
    }

    [Fact]
    public async Task AnUnknownStatusIs400OnTheStatusField()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);

        using var response = await client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), Body("ORD-2026-0714", "shipped", today, admin.UserId), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.ErrorFields(problem).ShouldBe(["status"]);
    }

    [Fact]
    public async Task AnUnknownReceiverIs400OnThePaymentField()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var today = await ExpenseFixtures.TodayAsync(factory);

        using var response = await client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), Body("ORD-2026-0715", "pending", today, Guid.NewGuid()), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.ErrorFields(problem).ShouldBe(["payments[0].receivedByUserId"]);
    }

    [Fact]
    public async Task DevelopmentDoesNotMapTheRoute()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseEnvironment(Environments.Development));
        using var client = factory.CreateClient();

        using var response = await client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), new { number = "ORD-2026-0716" }, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    private static Dictionary<string, object?> Body(string number, string status, DateOnly today, Guid receiver) => new()
    {
        ["number"] = number,
        ["status"] = status,
        ["customerName"] = "Juan Dela Cruz",
        ["contactNumber"] = "0917 123 4567",
        ["orderDate"] = OrderFixtures.Date(today.AddDays(-10)),
        ["dueDate"] = OrderFixtures.Date(today.AddDays(4)),
        ["items"] = new[] { OrderFixtures.Item(OrderFixtures.BasketballId) },
        ["payments"] = new[] { OrderFixtures.PaymentItem(today.AddDays(-3), 5000.00m, OrderFixtures.GCashId, receiver) },
    };

    private static async Task<Guid> CreateAsync(HttpClient client, Dictionary<string, object?> body)
    {
        using var response = await client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), body, TestContext.Current.CancellationToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.GetProperty("id").GetGuid();
    }
}
