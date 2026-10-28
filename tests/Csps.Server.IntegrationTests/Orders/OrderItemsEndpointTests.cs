using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-05, ORD-13, D-19, D-30, D-31: staff add, edit and remove the items of a saved order, and the totals follow every change.</summary>
public sealed class OrderItemsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AnAdminAddsAnItemToAManagersOrderAndTheTotalsGrow()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        using var response = await OrderFixtures.AddItemAsync(client, admin.AccessToken, id, OrderFixtures.ItemBody(OrderFixtures.PoloId, created.GetProperty("version").GetString()));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var saved = document.RootElement;
        var items = saved.GetProperty("items").EnumerateArray().ToList();
        items.Count.ShouldBe(2);
        items[0].GetProperty("lineTotal").GetDecimal().ShouldBe(9750.00m);
        items[1].GetProperty("description").GetString().ShouldBe("Coach polo");
        items[1].GetProperty("sizeVariant").GetString().ShouldBe("L");
        items[1].GetProperty("quantity").GetInt32().ShouldBe(2);
        items[1].GetProperty("unitPrice").GetDecimal().ShouldBe(550.00m);
        items[1].GetProperty("lineTotal").GetDecimal().ShouldBe(1100.00m);
        saved.GetProperty("totals").GetProperty("subtotal").GetDecimal().ShouldBe(10850.00m);
        saved.GetProperty("totals").GetProperty("total").GetDecimal().ShouldBe(10850.00m);
        saved.GetProperty("totals").GetProperty("balance").GetDecimal().ShouldBe(10850.00m);
        saved.GetProperty("version").GetString().ShouldNotBe(created.GetProperty("version").GetString());

        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        read.GetProperty("items").GetArrayLength().ShouldBe(2);
        read.GetProperty("totals").GetProperty("subtotal").GetDecimal().ShouldBe(10850.00m);
        read.GetProperty("version").GetString().ShouldBe(saved.GetProperty("version").GetString());
    }

    [Fact]
    public async Task AnonymousIsRefusedWith401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await OrderFixtures.AddItemAsync(client, accessToken: null, Guid.NewGuid(), new Dictionary<string, object?>());

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

        using var response = await OrderFixtures.AddItemAsync(client, manager.AccessToken, Guid.NewGuid(), OrderFixtures.ItemBody(OrderFixtures.PoloId, created.GetProperty("version").GetString()));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.not-found");
    }
}
