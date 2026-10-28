using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Orders;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.OrderLists;

/// <summary>
/// D-16 to D-20, D-31, Pitfall 7, T-07-49 to T-07-52: Managers own the three order lists. They add, rename, recolor, retire, bring
/// back and delete entries; names are unique; the order expense Others is protected; a used entry can only be retired; every change
/// is audited; an Admin is refused.
/// </summary>
public sealed class OrderListsManagementTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AManagerAddsAProductTypeAndStaffCanUseItOnANewOrderAtOnce()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var name = OrderListFixtures.UniqueName("Hoodie");

        using var response = await OrderListFixtures.PostAsync(client, OrderListFixtures.ProductTypes, manager.AccessToken, new { name = $" {name} ", tone = "info" });

        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        var created = document.RootElement;
        var id = created.GetProperty("id").GetGuid();
        created.GetProperty("name").GetString().ShouldBe(name);
        created.GetProperty("tone").GetString().ShouldBe("info");
        created.GetProperty("status").GetString().ShouldBe("active");
        created.GetProperty("isOthers").GetBoolean().ShouldBeFalse();
        created.GetProperty("useCount").GetInt32().ShouldBe(0);
        created.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        Convert.FromBase64String(created.GetProperty("version").GetString().ShouldNotBeNull()).Length.ShouldBe(8);
        response.Headers.Location.ShouldNotBeNull().ToString().ShouldBe($"/api/v1/product-types/{id:D}");

        var names = (await OrderListFixtures.ReadListAsync(client, OrderListFixtures.ProductTypes, admin.AccessToken)).Select(item => item.GetProperty("name").GetString()).ToList();
        names.IndexOf("Custom Design").ShouldBeLessThan(names.IndexOf(name));
        names.IndexOf(name).ShouldBeLessThan(names.IndexOf("Long Sleeves"));

        var today = await OrderFixtures.TodayAsync(factory);
        using var order = await OrderFixtures.PostAsync(client, admin.AccessToken, OrderFixtures.ValidBody(id, today));
        order.StatusCode.ShouldBe(HttpStatusCode.Created, await order.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

        await using var context = database.CreateContext();
        var key = id.ToString("D");
        var entry = await context.AuditLog.AsNoTracking().SingleAsync(row => row.TargetId == key && row.Action == "product-type.added", TestContext.Current.CancellationToken);
        entry.TargetType.ShouldBe("ProductType");
        entry.ActorUserId.ShouldBe(manager.UserId);
        entry.Detail.ShouldBe($"name={name};tone=info");
    }

    [Fact]
    public async Task AnAdminCannotAddAProductTypeAndNothingIsWritten()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var name = OrderListFixtures.UniqueName("Admin try");

        using var response = await OrderListFixtures.PostAsync(client, OrderListFixtures.ProductTypes, admin.AccessToken, new { name, tone = "info" });

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        await using var context = database.CreateContext();
        (await context.ProductTypes.CountAsync(entry => entry.Name == name, TestContext.Current.CancellationToken)).ShouldBe(0);
    }
}
