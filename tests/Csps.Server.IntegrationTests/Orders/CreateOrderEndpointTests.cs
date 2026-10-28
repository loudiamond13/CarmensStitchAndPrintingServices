using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-03, ORD-14, ORD-16, ORD-20, D-23: a staff member creates an order and reads it back; a stranger is refused.</summary>
public sealed class CreateOrderEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AnAdminCreatesAnOrderAndGets201WithTheNumberItemsTotalsAndFirstHistoryRow()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        var body = document.RootElement;
        var id = body.GetProperty("id").GetGuid();
        response.Headers.Location.ShouldNotBeNull().ToString().ShouldBe($"/api/v1/orders/{id:D}");
        body.GetProperty("number").GetString().ShouldBe($"ORD-{today.Year}-0001");
        body.GetProperty("status").GetString().ShouldBe("pending");
        body.GetProperty("customerName").GetString().ShouldBe("Juan Dela Cruz");
        body.GetProperty("teamName").GetString().ShouldBe("Brgy. San Roque Ballers");
        body.GetProperty("contactNumber").GetString().ShouldBe("0917 123 4567");
        body.GetProperty("email").GetString().ShouldBe("juan.dc@example.com");
        OrderFixtures.IsNull(body, "address").ShouldBeTrue();
        OrderFixtures.IsNull(body, "notes").ShouldBeTrue();
        body.GetProperty("orderDate").GetString().ShouldBe(OrderFixtures.Date(today));
        body.GetProperty("dueDate").GetString().ShouldBe(OrderFixtures.Date(today.AddDays(14)));

        var item = body.GetProperty("items").EnumerateArray().Single();
        item.GetProperty("description").GetString().ShouldBe("Jersey top");
        item.GetProperty("sizeVariant").GetString().ShouldBe("S-XL");
        item.GetProperty("quantity").GetInt32().ShouldBe(15);
        item.GetProperty("unitPrice").GetDecimal().ShouldBe(650.00m);
        item.GetProperty("lineTotal").GetDecimal().ShouldBe(9750.00m);
        var productType = item.GetProperty("productType");
        productType.GetProperty("id").GetGuid().ShouldBe(OrderFixtures.BasketballId);
        productType.GetProperty("name").GetString().ShouldBe("Basketball Jersey");
        productType.GetProperty("tone").GetString().ShouldNotBeNullOrWhiteSpace();
        productType.GetProperty("retired").GetBoolean().ShouldBeFalse();

        var totals = body.GetProperty("totals");
        totals.GetProperty("subtotal").GetDecimal().ShouldBe(9750.00m);
        totals.GetProperty("discount").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("total").GetDecimal().ShouldBe(9750.00m);
        totals.GetProperty("paid").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("refunded").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("balance").GetDecimal().ShouldBe(9750.00m);
        totals.GetProperty("customerCredit").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("expenses").GetDecimal().ShouldBe(0.00m);
        totals.GetProperty("profit").GetDecimal().ShouldBe(9750.00m);
        totals.GetProperty("fullyPaid").GetBoolean().ShouldBeFalse();

        var history = body.GetProperty("statusHistory").EnumerateArray().Single();
        OrderFixtures.IsNull(history, "from").ShouldBeTrue();
        history.GetProperty("to").GetString().ShouldBe("pending");
        history.GetProperty("changedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        history.GetProperty("changedAt").GetDateTimeOffset().ShouldBeGreaterThan(TimeProvider.System.GetUtcNow().AddMinutes(-5));

        body.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        OrderFixtures.IsNull(body, "lastChangedBy").ShouldBeTrue();
        body.GetProperty("version").GetString().ShouldNotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task ASecondCreateGetsTheNextNumber()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);

        var first = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var second = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));

        first.GetProperty("number").GetString().ShouldBe($"ORD-{today.Year}-0001");
        second.GetProperty("number").GetString().ShouldBe($"ORD-{today.Year}-0002");
    }

    [Fact]
    public async Task AManagerReadsTheSameOrderById()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));

        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid());

        read.GetRawText().ShouldBe(created.GetRawText());
    }

    [Fact]
    public async Task AnUnknownIdIs404WithTheNotFoundCode()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);

        using var response = await OrderFixtures.GetAsync(client, admin.AccessToken, Guid.NewGuid());

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.not-found");
    }

    [Fact]
    public async Task AnAnonymousPostGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await OrderFixtures.PostAsync(client, accessToken: null, OrderFixtures.ValidBody(OrderFixtures.BasketballId, new DateOnly(2026, 10, 28)));

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AnAnonymousGetGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await OrderFixtures.GetAsync(client, accessToken: null, Guid.NewGuid());

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task APostWithNoBodyIs400()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body: null);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.invalid-request");
    }
}
