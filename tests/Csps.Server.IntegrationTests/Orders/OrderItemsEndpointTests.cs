using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

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

    [Fact]
    public async Task ChangingTheQuantityRecomputesTheSubtotalAndTheBalanceAndGivesANewVersion()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var itemId = created.GetProperty("items")[0].GetProperty("id").GetGuid();
        var body = OrderFixtures.ItemBody(OrderFixtures.BasketballId, created.GetProperty("version").GetString(), "Jersey top", "S-XL", 20, 650.00m);

        using var response = await OrderFixtures.PutItemAsync(client, manager.AccessToken, id, itemId, body);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var saved = document.RootElement;
        saved.GetProperty("items")[0].GetProperty("quantity").GetInt32().ShouldBe(20);
        saved.GetProperty("items")[0].GetProperty("lineTotal").GetDecimal().ShouldBe(13000.00m);
        saved.GetProperty("totals").GetProperty("subtotal").GetDecimal().ShouldBe(13000.00m);
        saved.GetProperty("totals").GetProperty("balance").GetDecimal().ShouldBe(13000.00m);
        saved.GetProperty("version").GetString().ShouldNotBe(created.GetProperty("version").GetString());
        (await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id)).GetProperty("totals").GetProperty("subtotal").GetDecimal().ShouldBe(13000.00m);
    }

    [Fact]
    public async Task AnEditThatChangesNothingIsA200AndKeepsTheVersion()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var itemId = created.GetProperty("items")[0].GetProperty("id").GetGuid();
        var body = OrderFixtures.ItemBody(OrderFixtures.BasketballId, created.GetProperty("version").GetString(), "Jersey top", "S-XL", 15, 650.00m);

        using var response = await OrderFixtures.PutItemAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), itemId, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.GetProperty("version").GetString().ShouldBe(created.GetProperty("version").GetString());
    }

    [Fact]
    public async Task RemovingAnItemLeavesTheOthersAndRecomputesTheTotals()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var withTwo = await OrderFixtures.AddItemAndReadAsync(client, manager.AccessToken, created, OrderFixtures.PoloId);
        var addedId = withTwo.GetProperty("items")[1].GetProperty("id").GetGuid();

        using var response = await OrderFixtures.DeleteItemAsync(client, manager.AccessToken, id, addedId);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var saved = document.RootElement;
        saved.GetProperty("items").GetArrayLength().ShouldBe(1);
        saved.GetProperty("items")[0].GetProperty("description").GetString().ShouldBe("Jersey top");
        saved.GetProperty("totals").GetProperty("subtotal").GetDecimal().ShouldBe(9750.00m);
        saved.GetProperty("version").GetString().ShouldNotBe(withTwo.GetProperty("version").GetString());
    }

    [Fact]
    public async Task RemovingTheLastItemIsRefusedWithA422AndTheOrderIsUnchanged()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        using var response = await OrderFixtures.DeleteItemAsync(client, manager.AccessToken, id, created.GetProperty("items")[0].GetProperty("id").GetGuid());

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.last-item");
        problem.GetProperty("detail").GetString().ShouldBe("An order needs at least one item. Add another item before removing this one.");
        var stored = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("items").GetArrayLength().ShouldBe(1);
        stored.GetProperty("version").GetString().ShouldBe(created.GetProperty("version").GetString());
    }

    [Fact]
    public async Task AnItemOfAnotherOrderIsNeverFoundOnEditOrRemove()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var first = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var second = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var firstId = first.GetProperty("id").GetGuid();
        var foreignItem = second.GetProperty("items")[0].GetProperty("id").GetGuid();
        var body = OrderFixtures.ItemBody(OrderFixtures.BasketballId, first.GetProperty("version").GetString(), "Hijacked", null, 1, 1.00m);

        using var put = await OrderFixtures.PutItemAsync(client, manager.AccessToken, firstId, foreignItem, body);
        using var delete = await OrderFixtures.DeleteItemAsync(client, manager.AccessToken, firstId, foreignItem);

        foreach (var response in new[] { put, delete })
        {
            response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
            var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
            problem.GetProperty("code").GetString().ShouldBe("orders.item-not-found");
            problem.GetProperty("detail").GetString().ShouldBe("This item was not found on this order.");
        }

        var untouched = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, second.GetProperty("id").GetGuid());
        untouched.GetProperty("items")[0].GetProperty("description").GetString().ShouldBe("Jersey top");
        untouched.GetProperty("version").GetString().ShouldBe(second.GetProperty("version").GetString());
    }

    [Fact]
    public async Task AnItemRuleBrokenOnEditIsA400OnThatFieldAndNothingIsStored()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var itemId = created.GetProperty("items")[0].GetProperty("id").GetGuid();
        var body = OrderFixtures.ItemBody(OrderFixtures.BasketballId, created.GetProperty("version").GetString(), "Jersey top", "S-XL", 0, 650.00m);

        using var response = await OrderFixtures.PutItemAsync(client, manager.AccessToken, id, itemId, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.ErrorFields(problem).ShouldBe(["quantity"]);
        OrderFixtures.FieldErrors(problem, "quantity").ShouldBe(["Enter a quantity from 1 to 10,000."]);
        (await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id)).GetProperty("items")[0].GetProperty("quantity").GetInt32().ShouldBe(15);
    }

    [Fact]
    public async Task AStaleVersionOnAddAndOnEditIsA409AndStoresNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var itemId = created.GetProperty("items")[0].GetProperty("id").GetGuid();
        var openedVersion = created.GetProperty("version").GetString();
        var current = await OrderFixtures.AddItemAndReadAsync(client, manager.AccessToken, created, OrderFixtures.PoloId);

        using var staleAdd = await OrderFixtures.AddItemAsync(client, manager.AccessToken, id, OrderFixtures.ItemBody(OrderFixtures.PoloId, openedVersion, "Late add"));
        using var staleEdit = await OrderFixtures.PutItemAsync(client, manager.AccessToken, id, itemId, OrderFixtures.ItemBody(OrderFixtures.BasketballId, openedVersion, "Late edit", "S-XL", 1, 1.00m));

        foreach (var response in new[] { staleAdd, staleEdit })
        {
            response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
            var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
            problem.GetProperty("code").GetString().ShouldBe("edit.stale");
        }

        var stored = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("items").GetArrayLength().ShouldBe(2);
        stored.GetProperty("items")[0].GetProperty("description").GetString().ShouldBe("Jersey top");
        stored.GetProperty("version").GetString().ShouldBe(current.GetProperty("version").GetString());
    }

    [Fact]
    public async Task AHundredAndFirstItemIsRefusedWithA422()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["items"] = Enumerable.Range(1, 100).Select(number => OrderFixtures.Item(OrderFixtures.BasketballId, $"Item {number}", null, 1, 10.00m)).ToArray();
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, body);
        var id = created.GetProperty("id").GetGuid();

        using var response = await OrderFixtures.AddItemAsync(client, manager.AccessToken, id, OrderFixtures.ItemBody(OrderFixtures.PoloId, created.GetProperty("version").GetString()));

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.too-many-items");
        problem.GetProperty("detail").GetString().ShouldBe("An order can have at most 100 items.");
        (await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id)).GetProperty("items").GetArrayLength().ShouldBe(100);
    }

    [Fact]
    public async Task ARetiredProductTypeIsRefusedOnAddAndOnSwitchButAKeptRetiredTypeMayBeEdited()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.PoloId, today));
        var id = created.GetProperty("id").GetGuid();
        var itemId = created.GetProperty("items")[0].GetProperty("id").GetGuid();
        await SetRetiredAsync(OrderFixtures.PoloId, retired: true);
        try
        {
            using var add = await OrderFixtures.AddItemAsync(client, manager.AccessToken, id, OrderFixtures.ItemBody(OrderFixtures.PoloId, created.GetProperty("version").GetString()));
            var withJersey = await OrderFixtures.AddItemAndReadAsync(client, manager.AccessToken, created, OrderFixtures.BasketballId);
            var jerseyId = withJersey.GetProperty("items")[1].GetProperty("id").GetGuid();
            using var switchTo = await OrderFixtures.PutItemAsync(client, manager.AccessToken, id, jerseyId, OrderFixtures.ItemBody(OrderFixtures.PoloId, withJersey.GetProperty("version").GetString()));
            using var keep = await OrderFixtures.PutItemAsync(client, manager.AccessToken, id, itemId, OrderFixtures.ItemBody(OrderFixtures.PoloId, withJersey.GetProperty("version").GetString(), "Jersey top", "S-XL", 30, 650.00m));

            foreach (var response in new[] { add, switchTo })
            {
                response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
                var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
                OrderFixtures.ErrorFields(problem).ShouldBe(["productTypeId"]);
                OrderFixtures.FieldErrors(problem, "productTypeId").ShouldBe(["This product type was retired. Choose another one."]);
            }

            keep.StatusCode.ShouldBe(HttpStatusCode.OK, await keep.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            (await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id)).GetProperty("items")[0].GetProperty("quantity").GetInt32().ShouldBe(30);
        }
        finally
        {
            await SetRetiredAsync(OrderFixtures.PoloId, retired: false);
        }
    }

    private async Task SetRetiredAsync(Guid productTypeId, bool retired)
    {
        await using var context = database.CreateContext();
        DateTimeOffset? at = retired ? TimeProvider.System.GetUtcNow() : null;
        var changed = await context.ProductTypes.Where(type => type.Id == productTypeId)
            .ExecuteUpdateAsync(set => set.SetProperty(type => type.RetiredAtUtc, at), TestContext.Current.CancellationToken);
        changed.ShouldBe(1);
    }
}
