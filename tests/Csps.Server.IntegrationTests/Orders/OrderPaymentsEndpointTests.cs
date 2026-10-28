using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-05, ORD-20, ORD-22, D-11, D-12, D-30, D-31: staff record payments and the balance follows every change.</summary>
public sealed class OrderPaymentsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task TheOrd0148PaymentsLeaveABalanceOf9327AndEachPaymentNamesWhoReceivedIt()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148ItemsBody(today));
        var discounted = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, created, "percentage", 5m);
        var id = discounted.GetProperty("id").GetGuid();

        using var firstResponse = await OrderFixtures.AddPaymentAsync(
            client,
            admin.AccessToken,
            id,
            OrderFixtures.PaymentBody(today.AddDays(-3), 10000.00m, OrderFixtures.GCashId, admin.UserId, discounted.GetProperty("version").GetString(), "9012 345 678901", "50% downpayment"));
        var firstText = await firstResponse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        firstResponse.StatusCode.ShouldBe(HttpStatusCode.OK, firstText);
        using var firstDocument = JsonDocument.Parse(firstText);
        var afterFirst = firstDocument.RootElement.Clone();
        afterFirst.GetProperty("totals").GetProperty("paid").GetDecimal().ShouldBe(10000.00m);
        afterFirst.GetProperty("totals").GetProperty("balance").GetDecimal().ShouldBe(11327.50m);

        var afterSecond = await OrderFixtures.AddPaymentAndReadAsync(client, admin.AccessToken, afterFirst, today.AddDays(-1), 2000.00m, OrderFixtures.CashId, manager.UserId);

        var totals = afterSecond.GetProperty("totals");
        totals.GetProperty("paid").GetDecimal().ShouldBe(12000.00m);
        totals.GetProperty("balance").GetDecimal().ShouldBe(9327.50m);
        totals.GetProperty("profit").GetDecimal().ShouldBe(21327.50m);
        totals.GetProperty("customerCredit").GetDecimal().ShouldBe(0.00m);
        var payments = afterSecond.GetProperty("payments").EnumerateArray().ToList();
        payments.Count.ShouldBe(2);
        var gcash = payments[0];
        gcash.GetProperty("id").GetGuid().ShouldNotBe(Guid.Empty);
        gcash.GetProperty("paymentDate").GetString().ShouldBe(OrderFixtures.Date(today.AddDays(-3)));
        gcash.GetProperty("amount").GetDecimal().ShouldBe(10000.00m);
        gcash.GetProperty("method").GetProperty("id").GetGuid().ShouldBe(OrderFixtures.GCashId);
        gcash.GetProperty("method").GetProperty("name").GetString().ShouldBe("GCash");
        gcash.GetProperty("method").GetProperty("tone").GetString().ShouldNotBeNullOrEmpty();
        gcash.GetProperty("method").GetProperty("retired").GetBoolean().ShouldBeFalse();
        gcash.GetProperty("reference").GetString().ShouldBe("9012 345 678901");
        gcash.GetProperty("notes").GetString().ShouldBe("50% downpayment");
        gcash.GetProperty("receivedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        gcash.GetProperty("receivedByActive").GetBoolean().ShouldBeTrue();
        gcash.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        var cash = payments[1];
        cash.GetProperty("amount").GetDecimal().ShouldBe(2000.00m);
        cash.GetProperty("method").GetProperty("name").GetString().ShouldBe("Cash");
        cash.GetProperty("receivedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        cash.GetProperty("receivedByActive").GetBoolean().ShouldBeTrue();
        cash.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);

        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        read.GetProperty("payments").GetArrayLength().ShouldBe(2);
        read.GetProperty("totals").GetProperty("balance").GetDecimal().ShouldBe(9327.50m);
        read.GetProperty("version").GetString().ShouldBe(afterSecond.GetProperty("version").GetString());
    }

    [Fact]
    public async Task AnonymousIsRefusedWith401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await OrderFixtures.AddPaymentAsync(client, accessToken: null, Guid.NewGuid(), new Dictionary<string, object?>());

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

        using var response = await OrderFixtures.AddPaymentAsync(
            client,
            manager.AccessToken,
            Guid.NewGuid(),
            OrderFixtures.PaymentBody(today, 100m, OrderFixtures.CashId, manager.UserId, created.GetProperty("version").GetString()));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.not-found");
    }
}
