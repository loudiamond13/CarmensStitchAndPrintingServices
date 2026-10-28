using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Orders;
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

    [Fact]
    public async Task EachAddEditAndRemoveWritesExactlyOneEntryForTheOrderWithNoItemText()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var firstItem = created.GetProperty("items")[0].GetProperty("id").GetGuid();

        var withTwo = await OrderFixtures.AddItemAndReadAsync(client, manager.AccessToken, created, OrderFixtures.PoloId, "Private polo words");
        var added = withTwo.GetProperty("items")[1].GetProperty("id").GetGuid();
        using (var edit = await OrderFixtures.PutItemAsync(client, manager.AccessToken, id, added, OrderFixtures.ItemBody(OrderFixtures.PoloId, withTwo.GetProperty("version").GetString(), "Other private words", null, 3, 600.00m)))
        {
            edit.StatusCode.ShouldBe(HttpStatusCode.OK, await edit.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        using (var remove = await OrderFixtures.DeleteItemAsync(client, manager.AccessToken, id, firstItem))
        {
            remove.StatusCode.ShouldBe(HttpStatusCode.OK, await remove.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        await using var context = database.CreateContext();
        var rows = await context.AuditLog.AsNoTracking()
            .Where(row => row.TargetId == id.ToString("D") && row.Action.StartsWith("order-item."))
            .OrderBy(row => row.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
        rows.Select(static row => row.Action).ShouldBe(["order-item.added", "order-item.changed", "order-item.removed"]);
        rows.ShouldAllBe(row => row.TargetType == "Order" && row.ActorUserId == manager.UserId);
        rows[0].Detail.ShouldBe($"item={added:D};productType={OrderFixtures.PoloId:D};quantity=2;unitPrice=550.00");
        rows[1].Detail.ShouldBe($"item={added:D};productType={OrderFixtures.PoloId:D};quantity=2>3;unitPrice=550.00>600.00;fields=description,sizeVariant");
        rows[2].Detail.ShouldBe($"item={firstItem:D};productType={OrderFixtures.BasketballId:D};quantity=15;unitPrice=650.00");
        rows.ShouldAllBe(row => !row.Detail!.Contains("private", StringComparison.OrdinalIgnoreCase) && !row.Detail!.Contains("Jersey", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task ANoOpEditAndEveryRefusalWriteNoEntry()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var itemId = created.GetProperty("items")[0].GetProperty("id").GetGuid();
        var version = created.GetProperty("version").GetString();

        using (var noOp = await OrderFixtures.PutItemAsync(client, manager.AccessToken, id, itemId, OrderFixtures.ItemBody(OrderFixtures.BasketballId, version, "Jersey top", "S-XL", 15, 650.00m)))
        {
            noOp.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        using (var last = await OrderFixtures.DeleteItemAsync(client, manager.AccessToken, id, itemId))
        {
            last.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        }

        using (var invalid = await OrderFixtures.AddItemAsync(client, manager.AccessToken, id, OrderFixtures.ItemBody(OrderFixtures.PoloId, version, "Bad", null, 0, 1.00m)))
        {
            invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        }

        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.TargetId == id.ToString("D") && row.Action.StartsWith("order-item."), TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AnItemChangeStampsTheItemAndTheOrderWithTheCaller()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var firstItem = created.GetProperty("items")[0].GetProperty("id").GetGuid();

        var withTwo = await OrderFixtures.AddItemAndReadAsync(client, admin.AccessToken, created, OrderFixtures.PoloId);
        var added = withTwo.GetProperty("items")[1].GetProperty("id").GetGuid();

        withTwo.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        withTwo.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        (await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id)).GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        await using (var context = database.CreateContext())
        {
            var addedRow = await context.Set<OrderItem>().AsNoTracking().SingleAsync(item => item.Id == added, TestContext.Current.CancellationToken);
            addedRow.CreatedById.ShouldBe(admin.UserId);
            var firstRow = await context.Set<OrderItem>().AsNoTracking().SingleAsync(item => item.Id == firstItem, TestContext.Current.CancellationToken);
            firstRow.CreatedById.ShouldBe(manager.UserId);
            firstRow.UpdatedById.ShouldBeNull();
        }

        using var edit = await OrderFixtures.PutItemAsync(client, manager.AccessToken, id, added, OrderFixtures.ItemBody(OrderFixtures.PoloId, withTwo.GetProperty("version").GetString(), "Coach polo", "L", 5, 550.00m));
        edit.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var after = database.CreateContext();
        var editedRow = await after.Set<OrderItem>().AsNoTracking().SingleAsync(item => item.Id == added, TestContext.Current.CancellationToken);
        editedRow.CreatedById.ShouldBe(admin.UserId);
        editedRow.UpdatedById.ShouldBe(manager.UserId);
        (await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id)).GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
    }

    [Fact]
    public async Task ACutThatLeavesTheDiscountAboveTheNewSubtotalIsA422AndTheOrderIsUnchanged()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var itemId = created.GetProperty("items")[0].GetProperty("id").GetGuid();
        var withDiscount = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, created, "fixed", 9_000m);
        var body = OrderFixtures.ItemBody(OrderFixtures.BasketballId, withDiscount.GetProperty("version").GetString(), "Jersey top", "S-XL", 10, 650.00m);

        using var response = await OrderFixtures.PutItemAsync(client, manager.AccessToken, id, itemId, body);

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.discount-above-subtotal");
        problem.GetProperty("detail").GetString().ShouldBe("The discounts would be more than the items total. Lower or remove a discount first.");
        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        read.GetProperty("items")[0].GetProperty("quantity").GetInt32().ShouldBe(15);
        read.GetProperty("totals").GetProperty("subtotal").GetDecimal().ShouldBe(9750.00m);
        read.GetProperty("totals").GetProperty("discount").GetDecimal().ShouldBe(9000.00m);
        read.GetProperty("version").GetString().ShouldBe(withDiscount.GetProperty("version").GetString());
    }

    [Fact]
    public async Task ARemovalThatLeavesTheDiscountAboveTheNewSubtotalIsA422AndTheItemStays()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var withTwo = await OrderFixtures.AddItemAndReadAsync(client, manager.AccessToken, created, OrderFixtures.PoloId);
        var polo = withTwo.GetProperty("items")[1].GetProperty("id").GetGuid();
        var withDiscount = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, withTwo, "fixed", 10_000m);

        using var response = await OrderFixtures.DeleteItemAsync(client, manager.AccessToken, id, polo);

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.discount-above-subtotal");
        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        read.GetProperty("items").GetArrayLength().ShouldBe(2);
        read.GetProperty("version").GetString().ShouldBe(withDiscount.GetProperty("version").GetString());
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
