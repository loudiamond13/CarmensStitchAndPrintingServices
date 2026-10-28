using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-06, D-26 to D-29, D-31: staff delete an order, Managers find, restore and purge it, and a deleted order's money counts nowhere.</summary>
public sealed class OrderDeletionTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AnAdminDeletesAnOrderItDisappearsAManagerFindsItInTheDeletedListAndRestoresItWhole()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.Ord0148FullBody(today, admin.UserId, manager.UserId));
        var id = created.GetProperty("id").GetGuid();

        using var deleted = await OrderFixtures.DeleteAsync(client, admin.AccessToken, id);
        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        using var gone = await OrderFixtures.GetAsync(client, admin.AccessToken, id);
        gone.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(gone, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.not-found");

        var page = await OrderFixtures.ReadDeletedPageAsync(client, manager.AccessToken, "pageSize=100");
        var row = page.GetProperty("items").EnumerateArray().Single(item => item.GetProperty("id").GetGuid() == id);
        row.GetProperty("number").GetString().ShouldBe(created.GetProperty("number").GetString());
        row.GetProperty("customerName").GetString().ShouldBe("Juan Dela Cruz");
        row.GetProperty("teamName").GetString().ShouldBe("Brgy. San Roque Ballers");
        row.GetProperty("status").GetString().ShouldBe("pending");
        row.GetProperty("total").GetDecimal().ShouldBe(21327.50m);
        row.GetProperty("paid").GetDecimal().ShouldBe(12000.00m);
        row.GetProperty("balance").GetDecimal().ShouldBe(9327.50m);
        row.GetProperty("deletedAt").GetDateTimeOffset().ShouldBeGreaterThan(TimeProvider.System.GetUtcNow().AddMinutes(-5));
        row.GetProperty("deletedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);

        using var adminList = await OrderFixtures.ListDeletedAsync(client, admin.AccessToken);
        adminList.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        using var adminRestore = await OrderFixtures.RestoreAsync(client, admin.AccessToken, id);
        adminRestore.StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        using var restored = await OrderFixtures.RestoreAsync(client, manager.AccessToken, id);
        restored.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var back = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        back.GetProperty("items").GetArrayLength().ShouldBe(5);
        back.GetProperty("discounts").GetArrayLength().ShouldBe(1);
        back.GetProperty("payments").GetArrayLength().ShouldBe(2);
        back.GetProperty("expenses").GetArrayLength().ShouldBe(3);
        back.GetProperty("statusHistory").GetArrayLength().ShouldBe(1);
        var totals = back.GetProperty("totals");
        totals.GetProperty("total").GetDecimal().ShouldBe(21327.50m);
        totals.GetProperty("paid").GetDecimal().ShouldBe(12000.00m);
        totals.GetProperty("balance").GetDecimal().ShouldBe(9327.50m);
        var after = await OrderFixtures.ReadDeletedPageAsync(client, manager.AccessToken, "pageSize=100");
        after.GetProperty("items").EnumerateArray().Any(item => item.GetProperty("id").GetGuid() == id).ShouldBeFalse();
    }
}
