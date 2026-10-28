using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-18, ORD-05, ORD-08, D-07, D-09, D-13, D-30, D-34 to D-36: staff record, correct and remove refunds, and the money follows.</summary>
public sealed class OrderRefundsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AnAdminRefundsTheDownpaymentOnACancelledOrderAndTheOrderShowsALossOfItsExpenses()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.Ord0148FullBody(today, admin.UserId, manager.UserId));
        var id = created.GetProperty("id").GetGuid();
        var cancelled = await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "cancelled");

        using var response = await OrderFixtures.AddRefundAsync(
            client,
            admin.AccessToken,
            id,
            OrderFixtures.RefundBody(today, 12000.00m, "Order cancelled by the team", manager.UserId, cancelled.GetProperty("version").GetString()));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var after = document.RootElement;
        var totals = after.GetProperty("totals");
        totals.GetProperty("paid").GetDecimal().ShouldBe(12000.00m);
        totals.GetProperty("refunded").GetDecimal().ShouldBe(12000.00m);
        totals.GetProperty("expenses").GetDecimal().ShouldBe(6065.00m);
        totals.GetProperty("profit").GetDecimal().ShouldBe(-6065.00m);
        var refund = after.GetProperty("refunds").EnumerateArray().ShouldHaveSingleItem();
        refund.GetProperty("id").GetGuid().ShouldNotBe(Guid.Empty);
        refund.GetProperty("refundDate").GetString().ShouldBe(OrderFixtures.Date(today));
        refund.GetProperty("amount").GetDecimal().ShouldBe(12000.00m);
        refund.GetProperty("reason").GetString().ShouldBe("Order cancelled by the team");
        refund.GetProperty("refundedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        refund.GetProperty("refundedByActive").GetBoolean().ShouldBeTrue();
        refund.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        after.GetProperty("version").GetString().ShouldNotBe(cancelled.GetProperty("version").GetString());
        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        read.GetProperty("refunds").GetArrayLength().ShouldBe(1);
        read.GetProperty("totals").GetProperty("profit").GetDecimal().ShouldBe(-6065.00m);
    }

    [Fact]
    public async Task AnonymousIsRefusedWith401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await OrderFixtures.AddRefundAsync(client, accessToken: null, Guid.NewGuid(), new Dictionary<string, object?>());

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

        using var response = await OrderFixtures.AddRefundAsync(
            client,
            manager.AccessToken,
            Guid.NewGuid(),
            OrderFixtures.RefundBody(today, 100m, "Wrong order", manager.UserId, created.GetProperty("version").GetString()));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.not-found");
    }
}
