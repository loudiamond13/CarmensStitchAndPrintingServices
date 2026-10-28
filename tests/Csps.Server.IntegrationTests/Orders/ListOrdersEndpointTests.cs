using System.Net;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-01, ORD-02, ORD-20, PERF-04: staff list orders by due date with the stored totals, search, filter, sort and page.</summary>
public sealed class ListOrdersEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task StaffListOrdersByDueDateWithTheStoredTotalsAndADeletedOrderIsAbsent()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);

        var late = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        late["dueDate"] = OrderFixtures.Date(today.AddDays(20));
        var lateOrder = await OrderFixtures.CreateAsync(client, admin.AccessToken, late);
        var full = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.Ord0148FullBody(today, admin.UserId, manager.UserId));
        var soon = OrderFixtures.ValidBody(OrderFixtures.PoloId, today);
        soon["dueDate"] = OrderFixtures.Date(today.AddDays(3));
        var soonOrder = await OrderFixtures.CreateAsync(client, admin.AccessToken, soon);
        var gone = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.PoloId, today));
        using var deleted = await OrderFixtures.DeleteAsync(client, admin.AccessToken, gone.GetProperty("id").GetGuid());
        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var page = await OrderFixtures.ReadListAsync(client, admin.AccessToken);

        page.GetProperty("total").GetInt32().ShouldBe(3);
        page.GetProperty("page").GetInt32().ShouldBe(1);
        page.GetProperty("pageSize").GetInt32().ShouldBe(20);
        var items = page.GetProperty("items").EnumerateArray().ToList();
        items.Select(item => item.GetProperty("id").GetGuid()).ShouldBe(
            [soonOrder.GetProperty("id").GetGuid(), full.GetProperty("id").GetGuid(), lateOrder.GetProperty("id").GetGuid()]);

        var row = items[1];
        row.GetProperty("number").GetString().ShouldBe(full.GetProperty("number").GetString());
        row.GetProperty("customerName").GetString().ShouldBe("Juan Dela Cruz");
        row.GetProperty("teamName").GetString().ShouldBe("Brgy. San Roque Ballers");
        row.GetProperty("orderDate").GetString().ShouldBe(OrderFixtures.Date(today));
        row.GetProperty("dueDate").GetString().ShouldBe(OrderFixtures.Date(today.AddDays(14)));
        row.GetProperty("status").GetString().ShouldBe("pending");
        row.GetProperty("statusChangedAt").GetDateTimeOffset().ShouldBeGreaterThan(TimeProvider.System.GetUtcNow().AddMinutes(-5));
        row.GetProperty("subtotal").GetDecimal().ShouldBe(22450.00m);
        row.GetProperty("discount").GetDecimal().ShouldBe(1122.50m);
        row.GetProperty("total").GetDecimal().ShouldBe(21327.50m);
        row.GetProperty("paid").GetDecimal().ShouldBe(12000.00m);
        row.GetProperty("refunded").GetDecimal().ShouldBe(0.00m);
        row.GetProperty("balance").GetDecimal().ShouldBe(9327.50m);
        row.GetProperty("customerCredit").GetDecimal().ShouldBe(0.00m);
        row.GetProperty("fullyPaid").GetBoolean().ShouldBeFalse();
        row.EnumerateObject().Select(property => property.Name).ShouldNotContain("contactNumber");
    }

    [Fact]
    public async Task AnAnonymousCallerIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await OrderFixtures.ListAsync(client, accessToken: null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}
