using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-05, ORD-20, D-15, D-31: staff give an order discounts and the totals follow every change.</summary>
public sealed class OrderDiscountsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AStaffMemberAddsTheFivePercentLeagueDiscountAndTheTotalDropsTo21327()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148ItemsBody(today));
        var id = created.GetProperty("id").GetGuid();

        using var response = await OrderFixtures.AddDiscountAsync(
            client,
            admin.AccessToken,
            id,
            OrderFixtures.DiscountBody("percentage", 5m, "Barangay league discount", created.GetProperty("version").GetString()));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var saved = document.RootElement;
        var discount = saved.GetProperty("discounts").EnumerateArray().ShouldHaveSingleItem();
        discount.GetProperty("id").GetGuid().ShouldNotBe(Guid.Empty);
        discount.GetProperty("kind").GetString().ShouldBe("percentage");
        discount.GetProperty("value").GetDecimal().ShouldBe(5.00m);
        discount.GetProperty("reason").GetString().ShouldBe("Barangay league discount");
        discount.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        var totals = saved.GetProperty("totals");
        totals.GetProperty("subtotal").GetDecimal().ShouldBe(22450.00m);
        totals.GetProperty("discount").GetDecimal().ShouldBe(1122.50m);
        totals.GetProperty("total").GetDecimal().ShouldBe(21327.50m);
        totals.GetProperty("balance").GetDecimal().ShouldBe(21327.50m);
        totals.GetProperty("profit").GetDecimal().ShouldBe(21327.50m);
        saved.GetProperty("version").GetString().ShouldNotBe(created.GetProperty("version").GetString());

        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        read.GetProperty("discounts").GetArrayLength().ShouldBe(1);
        read.GetProperty("totals").GetProperty("total").GetDecimal().ShouldBe(21327.50m);
        read.GetProperty("version").GetString().ShouldBe(saved.GetProperty("version").GetString());
    }

    [Fact]
    public async Task AnonymousIsRefusedWith401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await OrderFixtures.AddDiscountAsync(client, accessToken: null, Guid.NewGuid(), new Dictionary<string, object?>());

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

        using var response = await OrderFixtures.AddDiscountAsync(
            client,
            manager.AccessToken,
            Guid.NewGuid(),
            OrderFixtures.DiscountBody("fixed", 100m, "Loyal customer", created.GetProperty("version").GetString()));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.not-found");
    }
}
