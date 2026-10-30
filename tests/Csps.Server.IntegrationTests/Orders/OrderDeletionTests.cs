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

    [Fact]
    public async Task ADeletedOrdersChildrenAndMoneyLeaveEveryDefaultReadAndComeBackOnRestore()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await CancelledWithRefundAsync(client, admin, manager, today);
        var id = order.GetProperty("id").GetGuid();
        var expected = new ChildRows(1, 5, 1, 2, 3, 1, 2);
        (await DefaultRowCountsAsync(id)).ShouldBe(expected);

        using var deleted = await OrderFixtures.DeleteAsync(client, manager.AccessToken, id);

        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await DefaultRowCountsAsync(id)).ShouldBe(new ChildRows(0, 0, 0, 0, 0, 0, 0));
        (await ChildRowCountsAsync(id)).ShouldBe(expected);
        await using (var context = database.CreateContext())
        {
            var token = TestContext.Current.CancellationToken;
            (await context.Set<OrderPayment>().Where(row => row.OrderId == id).SumAsync(row => row.Amount, token)).ShouldBe(0m);
            (await context.Set<OrderExpense>().Where(row => row.OrderId == id).SumAsync(row => row.Amount, token)).ShouldBe(0m);
            (await context.Set<OrderRefund>().Where(row => row.OrderId == id).SumAsync(row => row.Amount, token)).ShouldBe(0m);
        }

        using var restored = await OrderFixtures.RestoreAsync(client, manager.AccessToken, id);

        restored.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await DefaultRowCountsAsync(id)).ShouldBe(expected);
        var back = await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id);
        back.GetProperty("totals").GetProperty("refunded").GetDecimal().ShouldBe(3000.00m);
        back.GetProperty("totals").GetProperty("paid").GetDecimal().ShouldBe(12000.00m);
    }

    [Fact]
    public async Task AManagerReadsADeletedOrderWithEveryRowItsTotalsAndWhoDeletedIt()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await CancelledWithRefundAsync(client, admin, manager, today);
        var id = order.GetProperty("id").GetGuid();
        using (var deleted = await OrderFixtures.DeleteAsync(client, admin.AccessToken, id))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using var response = await OrderFixtures.GetDeletedAsync(client, manager.AccessToken, id);

        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        using var document = JsonDocument.Parse(text);
        var body = document.RootElement;
        body.GetProperty("deletedAt").GetDateTimeOffset().ShouldBeGreaterThan(TimeProvider.System.GetUtcNow().AddMinutes(-5));
        body.GetProperty("deletedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        var read = body.GetProperty("order");
        read.GetProperty("id").GetGuid().ShouldBe(id);
        read.GetProperty("number").GetString().ShouldBe(order.GetProperty("number").GetString());
        read.GetProperty("status").GetString().ShouldBe("cancelled");
        read.GetProperty("today").GetString().ShouldBe(OrderFixtures.Date(today));
        read.GetProperty("items").GetArrayLength().ShouldBe(5);
        read.GetProperty("discounts").GetArrayLength().ShouldBe(1);
        read.GetProperty("payments").GetArrayLength().ShouldBe(2);
        read.GetProperty("refunds").GetArrayLength().ShouldBe(1);
        read.GetProperty("expenses").GetArrayLength().ShouldBe(3);
        read.GetProperty("statusHistory").GetArrayLength().ShouldBe(2);
        var totals = read.GetProperty("totals");
        totals.GetProperty("total").GetDecimal().ShouldBe(21327.50m);
        totals.GetProperty("paid").GetDecimal().ShouldBe(12000.00m);
        totals.GetProperty("refunded").GetDecimal().ShouldBe(3000.00m);
        (await ChildRowCountsAsync(id)).ShouldBe(new ChildRows(1, 5, 1, 2, 3, 1, 2));
    }

    [Fact]
    public async Task ALiveOrderAnUnknownIdAndARestoredOrderAreEachA404ForTheDeletedRead()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.Ord0148FullBody(today, admin.UserId, manager.UserId));
        var id = order.GetProperty("id").GetGuid();

        using var live = await OrderFixtures.GetDeletedAsync(client, manager.AccessToken, id);
        using var unknown = await OrderFixtures.GetDeletedAsync(client, manager.AccessToken, Guid.NewGuid());
        using var deleted = await OrderFixtures.DeleteAsync(client, admin.AccessToken, id);
        using var whileDeleted = await OrderFixtures.GetDeletedAsync(client, manager.AccessToken, id);
        using var restore = await OrderFixtures.RestoreAsync(client, manager.AccessToken, id);
        using var afterRestore = await OrderFixtures.GetDeletedAsync(client, manager.AccessToken, id);

        live.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(live, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.not-found");
        unknown.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        whileDeleted.StatusCode.ShouldBe(HttpStatusCode.OK);
        restore.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        afterRestore.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(afterRestore, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.not-found");
    }

    [Fact]
    public async Task AnAdminAndAnAnonymousCallerCannotReadADeletedOrderAndGetNoOrderData()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await CancelledWithRefundAsync(client, admin, manager, today);
        var id = order.GetProperty("id").GetGuid();
        using (var deleted = await OrderFixtures.DeleteAsync(client, admin.AccessToken, id))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using var asAdmin = await OrderFixtures.GetDeletedAsync(client, admin.AccessToken, id);
        using var anonymous = await OrderFixtures.GetDeletedAsync(client, accessToken: null, id);

        asAdmin.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        foreach (var response in new[] { asAdmin, anonymous })
        {
            var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            foreach (var secret in new[] { order.GetProperty("number").GetString()!, "Juan", "Dela Cruz", "Ballers", "0917", "juan.dc", "Brgy", "Private reason", "totals", "items" })
            {
                text.ShouldNotContain(secret, Case.Insensitive);
            }
        }
    }

    [Fact]
    public async Task EveryRouteForADeletedOrderAnswers404OrdersNotFound()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await CancelledWithRefundAsync(client, admin, manager, today);
        var id = order.GetProperty("id").GetGuid();
        var version = order.GetProperty("version").GetString();
        var itemId = order.GetProperty("items")[0].GetProperty("id").GetGuid();
        var discountId = order.GetProperty("discounts")[0].GetProperty("id").GetGuid();
        var paymentId = order.GetProperty("payments")[0].GetProperty("id").GetGuid();
        var expenseId = order.GetProperty("expenses")[0].GetProperty("id").GetGuid();
        var refundId = order.GetProperty("refunds")[0].GetProperty("id").GetGuid();
        var details = OrderFixtures.DetailsBodyFrom(order);
        details["notes"] = "Changed on a deleted order";
        using (var deleted = await OrderFixtures.DeleteAsync(client, admin.AccessToken, id))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var requests = new (string Name, Func<Task<HttpResponseMessage>> Send)[]
        {
            ("GET", () => OrderFixtures.GetAsync(client, admin.AccessToken, id)),
            ("PUT details", () => OrderFixtures.PutDetailsAsync(client, admin.AccessToken, id, details)),
            ("POST status", () => OrderFixtures.ChangeStatusAsync(client, manager.AccessToken, id, OrderFixtures.StatusBody("pending"))),
            ("POST item", () => OrderFixtures.AddItemAsync(client, admin.AccessToken, id, OrderFixtures.ItemBody(OrderFixtures.PoloId, version))),
            ("PUT item", () => OrderFixtures.PutItemAsync(client, admin.AccessToken, id, itemId, OrderFixtures.ItemBody(OrderFixtures.PoloId, version, "Changed"))),
            ("DELETE item", () => OrderFixtures.DeleteItemAsync(client, admin.AccessToken, id, itemId)),
            ("POST discount", () => OrderFixtures.AddDiscountAsync(client, admin.AccessToken, id, OrderFixtures.DiscountBody("fixed", 10m, "Late", version))),
            ("PUT discount", () => OrderFixtures.PutDiscountAsync(client, admin.AccessToken, id, discountId, OrderFixtures.DiscountBody("fixed", 10m, "Changed", version))),
            ("DELETE discount", () => OrderFixtures.DeleteDiscountAsync(client, admin.AccessToken, id, discountId)),
            ("POST payment", () => OrderFixtures.AddPaymentAsync(client, admin.AccessToken, id, OrderFixtures.PaymentBody(today, 1m, OrderFixtures.CashId, admin.UserId, version))),
            ("PUT payment", () => OrderFixtures.PutPaymentAsync(client, admin.AccessToken, id, paymentId, OrderFixtures.PaymentBody(today, 5m, OrderFixtures.CashId, admin.UserId, version))),
            ("DELETE payment", () => OrderFixtures.DeletePaymentAsync(client, admin.AccessToken, id, paymentId)),
            ("POST expense", () => OrderFixtures.AddExpenseAsync(client, admin.AccessToken, id, OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, null, 1m, admin.UserId, version))),
            ("PUT expense", () => OrderFixtures.PutExpenseAsync(client, admin.AccessToken, id, expenseId, OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, "Changed", 2m, admin.UserId, version))),
            ("DELETE expense", () => OrderFixtures.DeleteExpenseAsync(client, admin.AccessToken, id, expenseId)),
            ("POST refund", () => OrderFixtures.AddRefundAsync(client, admin.AccessToken, id, OrderFixtures.RefundBody(today, 1m, "Late", manager.UserId, version))),
            ("PUT refund", () => OrderFixtures.PutRefundAsync(client, admin.AccessToken, id, refundId, OrderFixtures.RefundBody(today, 2m, "Changed", manager.UserId, version))),
            ("DELETE refund", () => OrderFixtures.DeleteRefundAsync(client, admin.AccessToken, id, refundId)),
            ("DELETE order again", () => OrderFixtures.DeleteAsync(client, admin.AccessToken, id)),
        };

        foreach (var (name, send) in requests)
        {
            using var response = await send();

            response.StatusCode.ShouldBe(HttpStatusCode.NotFound, name);
            (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.not-found", name);
        }

        (await ChildRowCountsAsync(id)).ShouldBe(new ChildRows(1, 5, 1, 2, 3, 1, 2));
    }

    [Fact]
    public async Task DeleteAndRestoreEachWriteOneEntryWithTheDocumentedKeysAndRepeatsWriteNone()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.Ord0148FullBody(today, admin.UserId, manager.UserId));
        var id = order.GetProperty("id").GetGuid();
        var number = order.GetProperty("number").GetString()!;
        var snapshot = $"number={number};status=pending;total=21327.50;paid=12000.00;balance=9327.50";
        var key = Guid.NewGuid();

        using var firstDelete = await OrderFixtures.DeleteAsync(client, admin.AccessToken, id);
        using var secondDelete = await OrderFixtures.DeleteAsync(client, admin.AccessToken, id);
        using var firstRestore = await OrderFixtures.RestoreAsync(client, manager.AccessToken, id, key);
        using var sameKeyRestore = await OrderFixtures.RestoreAsync(client, manager.AccessToken, id, key);
        using var liveRestore = await OrderFixtures.RestoreAsync(client, manager.AccessToken, id);

        firstDelete.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        secondDelete.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        firstRestore.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        sameKeyRestore.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        liveRestore.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        await using var context = database.CreateContext();
        var rows = await context.AuditLog.AsNoTracking()
            .Where(row => row.TargetId == id.ToString("D") && (row.Action == "order.deleted" || row.Action == "order.restored"))
            .OrderBy(row => row.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
        rows.Select(row => row.Action).ShouldBe(["order.deleted", "order.restored"]);
        rows.ShouldAllBe(row => row.TargetType == "Order" && row.Detail == snapshot);
        rows[0].ActorUserId.ShouldBe(admin.UserId);
        rows[1].ActorUserId.ShouldBe(manager.UserId);
        foreach (var secret in new[] { "Juan", "Dela Cruz", "Ballers", "0917", "juan.dc", "Brgy" })
        {
            snapshot.ShouldNotContain(secret, Case.Insensitive);
        }
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

    private async Task<ChildRows> DefaultRowCountsAsync(Guid id)
    {
        await using var context = database.CreateContext();
        var token = TestContext.Current.CancellationToken;
        return new ChildRows(
            await context.Orders.CountAsync(row => row.Id == id, token),
            await context.Set<OrderItem>().CountAsync(row => row.OrderId == id, token),
            await context.Set<OrderDiscount>().CountAsync(row => row.OrderId == id, token),
            await context.Set<OrderPayment>().CountAsync(row => row.OrderId == id, token),
            await context.Set<OrderExpense>().CountAsync(row => row.OrderId == id, token),
            await context.Set<OrderRefund>().CountAsync(row => row.OrderId == id, token),
            await context.Set<OrderStatusChange>().CountAsync(row => row.OrderId == id, token));
    }

    // Row counts for one order: the order, items, discounts, payments, expenses, refunds and history.
    private sealed record ChildRows(int Orders, int Items, int Discounts, int Payments, int Expenses, int Refunds, int History);
}
