using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>D-05, T-07-36: a Completed or Cancelled order refuses every details, item, discount, payment and expense write until it is reopened.</summary>
public sealed class OrderLockTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Theory]
    [InlineData("completed", "This order is completed. Reopen it to make changes.")]
    [InlineData("cancelled", "This order is cancelled. Reopen it to make changes.")]
    public async Task EveryWriteOnAnOrderInAnEndStateIs422LockedAndTheStoredOrderIsUnchanged(string endState, string message)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.Ord0148FullBody(today, admin.UserId, manager.UserId));
        var id = order.GetProperty("id").GetGuid();
        if (endState == "completed")
        {
            order = await OrderFixtures.AddPaymentAndReadAsync(client, admin.AccessToken, order, today, 9327.50m, OrderFixtures.CashId, admin.UserId);
        }

        var locked = await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, endState);
        var version = locked.GetProperty("version").GetString();
        var itemId = locked.GetProperty("items")[0].GetProperty("id").GetGuid();
        var discountId = locked.GetProperty("discounts")[0].GetProperty("id").GetGuid();
        var paymentId = locked.GetProperty("payments")[0].GetProperty("id").GetGuid();
        var expenseId = locked.GetProperty("expenses")[0].GetProperty("id").GetGuid();
        var before = (await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id)).GetRawText();
        var details = OrderFixtures.DetailsBodyFrom(locked);
        details["notes"] = "Changed on a locked order";

        var writes = new (string Name, Func<Task<HttpResponseMessage>> Send)[]
        {
            ("PUT details", () => OrderFixtures.PutDetailsAsync(client, admin.AccessToken, id, details)),
            ("POST item", () => OrderFixtures.AddItemAsync(client, admin.AccessToken, id, OrderFixtures.ItemBody(OrderFixtures.PoloId, version))),
            ("PUT item", () => OrderFixtures.PutItemAsync(client, manager.AccessToken, id, itemId, OrderFixtures.ItemBody(OrderFixtures.PoloId, version, "Changed"))),
            ("DELETE item", () => OrderFixtures.DeleteItemAsync(client, admin.AccessToken, id, itemId)),
            ("POST discount", () => OrderFixtures.AddDiscountAsync(client, admin.AccessToken, id, OrderFixtures.DiscountBody("fixed", 10m, "Late", version))),
            ("PUT discount", () => OrderFixtures.PutDiscountAsync(client, manager.AccessToken, id, discountId, OrderFixtures.DiscountBody("fixed", 10m, "Changed", version))),
            ("DELETE discount", () => OrderFixtures.DeleteDiscountAsync(client, admin.AccessToken, id, discountId)),
            ("POST payment", () => OrderFixtures.AddPaymentAsync(client, admin.AccessToken, id, OrderFixtures.PaymentBody(today, 1m, OrderFixtures.CashId, admin.UserId, version))),
            ("PUT payment", () => OrderFixtures.PutPaymentAsync(client, manager.AccessToken, id, paymentId, OrderFixtures.PaymentBody(today, 5m, OrderFixtures.CashId, admin.UserId, version))),
            ("DELETE payment", () => OrderFixtures.DeletePaymentAsync(client, admin.AccessToken, id, paymentId)),
            ("POST expense", () => OrderFixtures.AddExpenseAsync(client, admin.AccessToken, id, OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, null, 1m, admin.UserId, version))),
            ("PUT expense", () => OrderFixtures.PutExpenseAsync(client, manager.AccessToken, id, expenseId, OrderFixtures.ExpenseBody(today, OrderFixtures.FabricId, "Changed", 2m, admin.UserId, version))),
            ("DELETE expense", () => OrderFixtures.DeleteExpenseAsync(client, admin.AccessToken, id, expenseId)),
        };

        foreach (var (name, send) in writes)
        {
            using var response = await send();

            response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity, name);
            var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
            problem.GetProperty("code").GetString().ShouldBe("orders.locked", name);
            problem.GetProperty("detail").GetString().ShouldBe(message, name);
        }

        (await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id)).GetRawText().ShouldBe(before);
    }

    [Theory]
    [InlineData("completed")]
    [InlineData("cancelled")]
    public async Task AfterAReopenTheSameWritesSucceedAgain(string endState)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.Ord0148FullBody(today, admin.UserId, manager.UserId));
        var id = order.GetProperty("id").GetGuid();
        if (endState == "completed")
        {
            order = await OrderFixtures.AddPaymentAndReadAsync(client, admin.AccessToken, order, today, 9327.50m, OrderFixtures.CashId, admin.UserId);
        }

        await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, endState);
        using (var refused = await OrderFixtures.AddItemAsync(client, admin.AccessToken, id, OrderFixtures.ItemBody(OrderFixtures.PoloId, (await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id)).GetProperty("version").GetString())))
        {
            refused.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        }

        var reopened = await OrderFixtures.ChangeStatusAndReadAsync(client, admin.AccessToken, id, "ready");
        var withItem = await OrderFixtures.AddItemAndReadAsync(client, admin.AccessToken, reopened, OrderFixtures.PoloId);
        var details = OrderFixtures.DetailsBodyFrom(withItem);
        details["notes"] = "Edited after the reopen";
        using var edited = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, id, details);

        withItem.GetProperty("items").GetArrayLength().ShouldBe(6);
        edited.StatusCode.ShouldBe(HttpStatusCode.OK, await edited.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var stored = await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id);
        stored.GetProperty("notes").GetString().ShouldBe("Edited after the reopen");
        stored.GetProperty("status").GetString().ShouldBe("ready");
    }

    [Fact]
    public async Task AReadOfAnEndStateOrderStillWorksAndAMissingOrderIsStillA404()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        await OrderFixtures.ChangeStatusAndReadAsync(client, admin.AccessToken, id, "cancelled");

        var read = await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id);
        using var missing = await OrderFixtures.DeleteItemAsync(client, admin.AccessToken, Guid.NewGuid(), Guid.NewGuid());

        read.GetProperty("status").GetString().ShouldBe("cancelled");
        missing.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(missing, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.not-found");
    }
}
