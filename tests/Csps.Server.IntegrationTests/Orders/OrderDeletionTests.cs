using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Orders;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

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

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task AManagerDeletesADeletedOrALiveOrderForGoodWithItsNumberAndEveryRowGoesButTheAuditEntryStays(bool softDeletedFirst)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await CancelledWithRefundAsync(client, admin, manager, today);
        var id = order.GetProperty("id").GetGuid();
        var number = order.GetProperty("number").GetString()!;
        (await ChildRowCountsAsync(id)).ShouldBe(new ChildRows(1, 5, 1, 2, 3, 1, 2));
        if (softDeletedFirst)
        {
            using var deleted = await OrderFixtures.DeleteAsync(client, admin.AccessToken, id);
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using var response = await OrderFixtures.PermanentlyDeleteAsync(client, manager.AccessToken, id, number);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await ChildRowCountsAsync(id)).ShouldBe(new ChildRows(0, 0, 0, 0, 0, 0, 0));
        using var gone = await OrderFixtures.GetAsync(client, manager.AccessToken, id);
        gone.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var page = await OrderFixtures.ReadDeletedPageAsync(client, manager.AccessToken, "pageSize=100");
        page.GetProperty("items").EnumerateArray().Any(item => item.GetProperty("id").GetGuid() == id).ShouldBeFalse();
        await using var context = database.CreateContext();
        var entry = await context.AuditLog.AsNoTracking()
            .SingleAsync(row => row.TargetId == id.ToString("D") && row.Action == "order.permanently-deleted", TestContext.Current.CancellationToken);
        entry.TargetType.ShouldBe("Order");
        entry.ActorUserId.ShouldBe(manager.UserId);
        var detail = entry.Detail.ShouldNotBeNull();
        detail.ShouldStartWith($"number={number};status=cancelled;subtotal=22450.00;discount=1122.50;total=21327.50;paid=12000.00;refunded=3000.00;");
        detail.ShouldContain($";receivers={admin.UserId:D},{manager.UserId:D};");
        detail.ShouldContain($";payers={manager.UserId:D},{admin.UserId:D};");
        detail.ShouldEndWith($";refunders={manager.UserId:D}");
        foreach (var secret in new[] { "Juan", "Dela Cruz", "Ballers", "0917", "juan.dc", "Brgy", "Dri-fit", "Private reason" })
        {
            detail.ShouldNotContain(secret, Case.Insensitive);
        }
    }

    [Theory]
    [InlineData("ord-2026-0001")]
    [InlineData(" ")]
    [InlineData("")]
    [InlineData(null)]
    public async Task APermanentDeleteWithoutTheExactNumberIs400OnConfirmAndRemovesNothing(string? confirm)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.Ord0148FullBody(today, admin.UserId, manager.UserId));
        var id = order.GetProperty("id").GetGuid();

        using var response = await OrderFixtures.PermanentlyDeleteAsync(client, manager.AccessToken, id, confirm);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.invalid-request");
        OrderFixtures.FieldErrors(problem, "confirm").ShouldBe(["Type the order number exactly to delete it for good."]);
        (await ChildRowCountsAsync(id)).ShouldBe(new ChildRows(1, 5, 1, 2, 3, 0, 1));
        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.TargetId == id.ToString("D") && row.Action == "order.permanently-deleted", TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AnAdminCannotDeleteForGoodAndAnUnknownOrderIs404EvenWithABadConfirm()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.Ord0148FullBody(today, admin.UserId, manager.UserId));
        var id = order.GetProperty("id").GetGuid();

        using var asAdmin = await OrderFixtures.PermanentlyDeleteAsync(client, admin.AccessToken, id, order.GetProperty("number").GetString());
        using var anonymous = await OrderFixtures.PermanentlyDeleteAsync(client, accessToken: null, id, order.GetProperty("number").GetString());
        using var unknown = await OrderFixtures.PermanentlyDeleteAsync(client, manager.AccessToken, Guid.NewGuid(), "wrong");

        asAdmin.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        unknown.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(unknown, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.not-found");
        (await ChildRowCountsAsync(id)).Orders.ShouldBe(1);
    }

    private static async Task<JsonElement> CancelledWithRefundAsync(HttpClient client, StartedSession admin, StartedSession manager, DateOnly today)
    {
        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.Ord0148FullBody(today, admin.UserId, manager.UserId));
        var cancelled = await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), "cancelled");
        return await OrderFixtures.AddRefundAndReadAsync(client, admin.AccessToken, cancelled, today, 3000.00m, manager.UserId, "Private reason for the refund");
    }

    private async Task<ChildRows> ChildRowCountsAsync(Guid id)
    {
        await using var context = database.CreateContext();
        var token = TestContext.Current.CancellationToken;
        return new ChildRows(
            await context.Orders.IgnoreQueryFilters(["SoftDelete"]).CountAsync(row => row.Id == id, token),
            await context.Set<OrderItem>().IgnoreQueryFilters(["SoftDelete"]).CountAsync(row => row.OrderId == id, token),
            await context.Set<OrderDiscount>().IgnoreQueryFilters(["SoftDelete"]).CountAsync(row => row.OrderId == id, token),
            await context.Set<OrderPayment>().IgnoreQueryFilters(["SoftDelete"]).CountAsync(row => row.OrderId == id, token),
            await context.Set<OrderExpense>().IgnoreQueryFilters(["SoftDelete"]).CountAsync(row => row.OrderId == id, token),
            await context.Set<OrderRefund>().IgnoreQueryFilters(["SoftDelete"]).CountAsync(row => row.OrderId == id, token),
            await context.Set<OrderStatusChange>().IgnoreQueryFilters(["SoftDelete"]).CountAsync(row => row.OrderId == id, token));
    }

    // Row counts for one order, with the SoftDelete filter lifted: the order, items, discounts, payments, expenses, refunds and history.
    private sealed record ChildRows(int Orders, int Items, int Discounts, int Payments, int Expenses, int Refunds, int History);
}
