using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-05, ORD-20, D-15, D-31: staff give an order discounts and the totals follow every change.</summary>
public sealed class OrderDiscountsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AStaffMemberAddsTheFivePercentLeagueDiscountAndTheTotalDropsTo21327()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148ItemsBody(today));
        var id = created.GetProperty("id").GetGuid();

        using var response = await OrderFixtures.AddDiscountAsync(
            client,
            admin.AccessToken,
            id,
            OrderFixtures.DiscountBody("percentage", 5m, "Barangay league discount", created.GetProperty("version").GetString()));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var saved = document.RootElement;
        var discount = saved.GetProperty("discounts").EnumerateArray().ShouldHaveSingleItem();
        discount.GetProperty("id").GetGuid().ShouldNotBe(Guid.Empty);
        discount.GetProperty("kind").GetString().ShouldBe("percentage");
        discount.GetProperty("value").GetDecimal().ShouldBe(5.00m);
        discount.GetProperty("reason").GetString().ShouldBe("Barangay league discount");
        discount.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        var totals = saved.GetProperty("totals");
        totals.GetProperty("subtotal").GetDecimal().ShouldBe(22450.00m);
        totals.GetProperty("discount").GetDecimal().ShouldBe(1122.50m);
        totals.GetProperty("total").GetDecimal().ShouldBe(21327.50m);
        totals.GetProperty("balance").GetDecimal().ShouldBe(21327.50m);
        totals.GetProperty("profit").GetDecimal().ShouldBe(21327.50m);
        saved.GetProperty("version").GetString().ShouldNotBe(created.GetProperty("version").GetString());

        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        read.GetProperty("discounts").GetArrayLength().ShouldBe(1);
        read.GetProperty("totals").GetProperty("total").GetDecimal().ShouldBe(21327.50m);
        read.GetProperty("version").GetString().ShouldBe(saved.GetProperty("version").GetString());
    }

    [Fact]
    public async Task AFivePercentDiscountAnswerAndReadCarryTheServerAmount()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148ItemsBody(today));

        var withPercent = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, created, "percentage", 5m);

        withPercent.GetProperty("discounts").EnumerateArray().ShouldHaveSingleItem().GetProperty("amount").GetDecimal().ShouldBe(1122.50m);
        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid());
        read.GetProperty("discounts").EnumerateArray().ShouldHaveSingleItem().GetProperty("amount").GetDecimal().ShouldBe(1122.50m);
    }

    [Fact]
    public async Task AFixedDiscountAfterItCarriesItsOwnAmountAndTheAmountsAddUpToTheDiscountTotal()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148ItemsBody(today));
        var id = created.GetProperty("id").GetGuid();
        var withPercent = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, created, "percentage", 5m);

        var withBoth = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, withPercent, "fixed", 500m, "Loyal customer");
        var amounts = withBoth.GetProperty("discounts").EnumerateArray().Select(static d => d.GetProperty("amount").GetDecimal()).ToList();
        amounts.ShouldBe([1122.50m, 500.00m]);
        amounts.Sum().ShouldBe(withBoth.GetProperty("totals").GetProperty("discount").GetDecimal());
        withBoth.GetProperty("totals").GetProperty("discount").GetDecimal().ShouldBe(1622.50m);

        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        read.GetProperty("discounts").EnumerateArray().Select(static d => d.GetProperty("amount").GetDecimal()).ShouldBe([1122.50m, 500.00m]);
    }

    [Fact]
    public async Task AnItemChangeMovesAPercentageDiscountAmountToTheNewSubtotal()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148ItemsBody(today));
        var id = created.GetProperty("id").GetGuid();
        var itemId = created.GetProperty("items")[0].GetProperty("id").GetGuid();
        var withDiscount = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, created, "percentage", 5m);

        // 20 jersey tops at 650.00 move the subtotal from 22,450.00 to 25,700.00; 5% of that is 1,285.00.
        using var response = await OrderFixtures.PutItemAsync(
            client,
            manager.AccessToken,
            id,
            itemId,
            OrderFixtures.ItemBody(OrderFixtures.BasketballId, withDiscount.GetProperty("version").GetString(), "Jersey top", "S-XL", 20, 650.00m));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var saved = document.RootElement;
        saved.GetProperty("totals").GetProperty("subtotal").GetDecimal().ShouldBe(25700.00m);
        saved.GetProperty("discounts").EnumerateArray().ShouldHaveSingleItem().GetProperty("amount").GetDecimal().ShouldBe(1285.00m);
        saved.GetProperty("totals").GetProperty("discount").GetDecimal().ShouldBe(1285.00m);
    }

    [Fact]
    public async Task AManagersDeletedOrderReadCarriesTheSameDiscountAmounts()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148ItemsBody(today));
        var id = created.GetProperty("id").GetGuid();
        var withPercent = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, created, "percentage", 5m);
        await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, withPercent, "fixed", 500m, "Loyal customer");
        using (var deleted = await OrderFixtures.DeleteAsync(client, admin.AccessToken, id))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using var response = await OrderFixtures.GetDeletedAsync(client, manager.AccessToken, id);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var discounts = document.RootElement.GetProperty("order").GetProperty("discounts");
        discounts.EnumerateArray().Select(static d => d.GetProperty("amount").GetDecimal()).ShouldBe([1122.50m, 500.00m]);
    }

    [Fact]
    public async Task AnonymousIsRefusedWith401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await OrderFixtures.AddDiscountAsync(client, accessToken: null, Guid.NewGuid(), new Dictionary<string, object?>());

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

        using var response = await OrderFixtures.AddDiscountAsync(
            client,
            manager.AccessToken,
            Guid.NewGuid(),
            OrderFixtures.DiscountBody("fixed", 100m, "Loyal customer", created.GetProperty("version").GetString()));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.not-found");
    }

    [Fact]
    public async Task EditingTheValueFromFiveToTenPercentRecomputesTheDiscountTo2245()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148ItemsBody(today));
        var withDiscount = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, created, "percentage", 5m);
        var id = created.GetProperty("id").GetGuid();
        var discountId = withDiscount.GetProperty("discounts")[0].GetProperty("id").GetGuid();

        using var response = await OrderFixtures.PutDiscountAsync(
            client,
            admin.AccessToken,
            id,
            discountId,
            OrderFixtures.DiscountBody("percentage", 10m, "Barangay league discount", withDiscount.GetProperty("version").GetString()));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var saved = document.RootElement;
        var discount = saved.GetProperty("discounts").EnumerateArray().ShouldHaveSingleItem();
        discount.GetProperty("id").GetGuid().ShouldBe(discountId);
        discount.GetProperty("value").GetDecimal().ShouldBe(10.00m);
        discount.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        discount.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        saved.GetProperty("totals").GetProperty("discount").GetDecimal().ShouldBe(2245.00m);
        saved.GetProperty("totals").GetProperty("total").GetDecimal().ShouldBe(20205.00m);
        saved.GetProperty("version").GetString().ShouldNotBe(withDiscount.GetProperty("version").GetString());
        (await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id)).GetProperty("totals").GetProperty("balance").GetDecimal().ShouldBe(20205.00m);
    }

    [Fact]
    public async Task RemovingTheDiscountBringsTheDiscountBackToZero()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148ItemsBody(today));
        var withDiscount = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, created, "percentage", 5m);
        var id = created.GetProperty("id").GetGuid();
        var discountId = withDiscount.GetProperty("discounts")[0].GetProperty("id").GetGuid();

        using var response = await OrderFixtures.DeleteDiscountAsync(client, manager.AccessToken, id, discountId);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var saved = document.RootElement;
        saved.GetProperty("discounts").GetArrayLength().ShouldBe(0);
        saved.GetProperty("totals").GetProperty("discount").GetDecimal().ShouldBe(0.00m);
        saved.GetProperty("totals").GetProperty("total").GetDecimal().ShouldBe(22450.00m);
        saved.GetProperty("version").GetString().ShouldNotBe(withDiscount.GetProperty("version").GetString());
    }

    [Fact]
    public async Task ADiscountAboveTheItemsTotalIsA400OnValueAndTheOrderIsUnchanged()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148ItemsBody(today));
        var id = created.GetProperty("id").GetGuid();

        using var response = await OrderFixtures.AddDiscountAsync(
            client,
            manager.AccessToken,
            id,
            OrderFixtures.DiscountBody("fixed", 30_000m, "Too big", created.GetProperty("version").GetString()));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.FieldErrors(problem, "value").ShouldBe(["The discounts would be more than the items total. Lower or remove a discount first."]);
        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        read.GetProperty("discounts").GetArrayLength().ShouldBe(0);
        read.GetProperty("version").GetString().ShouldBe(created.GetProperty("version").GetString());
    }

    [Fact]
    public async Task AnEditThatWouldPassTheItemsTotalIsA400OnValueAndTheDiscountIsUnchanged()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148ItemsBody(today));
        var withDiscount = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, created, "percentage", 5m);
        var id = created.GetProperty("id").GetGuid();
        var discountId = withDiscount.GetProperty("discounts")[0].GetProperty("id").GetGuid();

        using var response = await OrderFixtures.PutDiscountAsync(
            client,
            manager.AccessToken,
            id,
            discountId,
            OrderFixtures.DiscountBody("fixed", 22_450.01m, "Too big", withDiscount.GetProperty("version").GetString()));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.FieldErrors(problem, "value").Count.ShouldBe(1);
        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        read.GetProperty("discounts")[0].GetProperty("value").GetDecimal().ShouldBe(5.00m);
        read.GetProperty("version").GetString().ShouldBe(withDiscount.GetProperty("version").GetString());
    }

    [Fact]
    public async Task ADiscountIdFromAnotherOrderIsNeverFoundOnEditOrRemove()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var first = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var second = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var firstWithDiscount = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, first, "fixed", 100m);
        var foreignId = firstWithDiscount.GetProperty("discounts")[0].GetProperty("id").GetGuid();
        var secondId = second.GetProperty("id").GetGuid();

        using var edit = await OrderFixtures.PutDiscountAsync(
            client,
            manager.AccessToken,
            secondId,
            foreignId,
            OrderFixtures.DiscountBody("fixed", 1m, "Hijack", second.GetProperty("version").GetString()));
        using var remove = await OrderFixtures.DeleteDiscountAsync(client, manager.AccessToken, secondId, foreignId);

        edit.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(edit, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.discount-not-found");
        remove.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(remove, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.discount-not-found");
        var firstRead = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, first.GetProperty("id").GetGuid());
        firstRead.GetProperty("discounts")[0].GetProperty("value").GetDecimal().ShouldBe(100.00m);
        (await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, secondId)).GetProperty("discounts").GetArrayLength().ShouldBe(0);
    }

    [Fact]
    public async Task AStaleVersionOnAddOrEditIs409AndNothingIsStored()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var withDiscount = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, created, "fixed", 100m);
        var discountId = withDiscount.GetProperty("discounts")[0].GetProperty("id").GetGuid();
        var oldVersion = created.GetProperty("version").GetString();

        using var add = await OrderFixtures.AddDiscountAsync(client, manager.AccessToken, id, OrderFixtures.DiscountBody("fixed", 50m, "Second", oldVersion));
        using var edit = await OrderFixtures.PutDiscountAsync(client, manager.AccessToken, id, discountId, OrderFixtures.DiscountBody("fixed", 60m, "Edited", oldVersion));

        add.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemJson.ReadAsync(add, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("edit.stale");
        edit.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemJson.ReadAsync(edit, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("edit.stale");
        var read = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        read.GetProperty("discounts").GetArrayLength().ShouldBe(1);
        read.GetProperty("discounts")[0].GetProperty("value").GetDecimal().ShouldBe(100.00m);
        read.GetProperty("version").GetString().ShouldBe(withDiscount.GetProperty("version").GetString());
    }

    [Fact]
    public async Task ATwentyFirstDiscountIsA422AndTheTwentiethIsAccepted()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = order.GetProperty("id").GetGuid();
        for (var count = 1; count <= 20; count++)
        {
            order = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, order, "fixed", 1m, $"Discount {count}");
        }

        using var response = await OrderFixtures.AddDiscountAsync(
            client,
            manager.AccessToken,
            id,
            OrderFixtures.DiscountBody("fixed", 1m, "One too many", order.GetProperty("version").GetString()));

        order.GetProperty("discounts").GetArrayLength().ShouldBe(20);
        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.too-many-discounts");
        problem.GetProperty("detail").GetString().ShouldBe("An order can have at most 20 discounts.");
    }

    [Fact]
    public async Task AnEmptyBodyListsEveryRequiredFieldAndAnUnknownOrderIsA404OnEditAndRemove()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var empty = await OrderFixtures.AddDiscountAsync(client, manager.AccessToken, Guid.NewGuid(), new Dictionary<string, object?>());
        using var edit = await OrderFixtures.PutDiscountAsync(client, manager.AccessToken, Guid.NewGuid(), Guid.NewGuid(), OrderFixtures.DiscountBody("fixed", 1m, "Reason", "AAAAAAAAH6Q="));
        using var remove = await OrderFixtures.DeleteDiscountAsync(client, manager.AccessToken, Guid.NewGuid(), Guid.NewGuid());

        empty.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderFixtures.ErrorFields(await ProblemJson.ReadAsync(empty, TestContext.Current.CancellationToken)).ShouldBe(["kind", "reason", "value", "version"]);
        edit.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        remove.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(remove, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.not-found");
    }

    [Fact]
    public async Task EachAddEditAndRemoveWritesExactlyOneEntryForTheOrderWithNoReasonText()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148ItemsBody(today));
        var id = created.GetProperty("id").GetGuid();

        var added = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, created, "percentage", 5m, "Private league words");
        var discountId = added.GetProperty("discounts")[0].GetProperty("id").GetGuid();
        using (var edit = await OrderFixtures.PutDiscountAsync(client, manager.AccessToken, id, discountId, OrderFixtures.DiscountBody("fixed", 500m, "Other private words", added.GetProperty("version").GetString())))
        {
            edit.StatusCode.ShouldBe(HttpStatusCode.OK, await edit.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        using (var remove = await OrderFixtures.DeleteDiscountAsync(client, manager.AccessToken, id, discountId))
        {
            remove.StatusCode.ShouldBe(HttpStatusCode.OK, await remove.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        await using var context = database.CreateContext();
        var rows = await context.AuditLog.AsNoTracking()
            .Where(row => row.TargetId == id.ToString("D") && row.Action.StartsWith("order-discount."))
            .OrderBy(row => row.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
        rows.Select(static row => row.Action).ShouldBe(["order-discount.added", "order-discount.changed", "order-discount.removed"]);
        rows.ShouldAllBe(row => row.TargetType == "Order" && row.ActorUserId == manager.UserId);
        rows[0].Detail.ShouldBe($"discount={discountId:D};kind=percentage;value=5.00");
        rows[1].Detail.ShouldBe($"discount={discountId:D};kind=percentage>fixed;value=5.00>500.00;fields=reason");
        rows[2].Detail.ShouldBe($"discount={discountId:D};kind=fixed;value=500.00");
        rows.ShouldAllBe(row => !row.Detail!.Contains("private", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task ANoOpEditAndEveryRefusalWriteNoEntry()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.Ord0148ItemsBody(today));
        var id = created.GetProperty("id").GetGuid();
        var added = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, created, "percentage", 5m);
        var discountId = added.GetProperty("discounts")[0].GetProperty("id").GetGuid();
        var version = added.GetProperty("version").GetString();

        using var noOp = await OrderFixtures.PutDiscountAsync(client, manager.AccessToken, id, discountId, OrderFixtures.DiscountBody("percentage", 5m, "Barangay league discount", version));
        using var tooBig = await OrderFixtures.AddDiscountAsync(client, manager.AccessToken, id, OrderFixtures.DiscountBody("fixed", 30_000m, "Too big", version));
        using var stale = await OrderFixtures.AddDiscountAsync(client, manager.AccessToken, id, OrderFixtures.DiscountBody("fixed", 10m, "Stale", created.GetProperty("version").GetString()));
        using var missing = await OrderFixtures.DeleteDiscountAsync(client, manager.AccessToken, id, Guid.NewGuid());

        noOp.StatusCode.ShouldBe(HttpStatusCode.OK);
        using (var document = JsonDocument.Parse(await noOp.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)))
        {
            document.RootElement.GetProperty("version").GetString().ShouldBe(version);
        }

        tooBig.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        stale.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        missing.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.TargetId == id.ToString("D") && row.Action.StartsWith("order-discount."), TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task TwoDiscountAddsWithTheSameVersionGiveExactlyOneWinnerEveryTime()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var first = await TestSessions.StartAsync(factory, Roles.Manager);
        var second = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, first.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();

        for (var round = 1; round <= 5; round++)
        {
            var opened = await OrderFixtures.ReadDetailAsync(client, first.AccessToken, id);
            var version = opened.GetProperty("version").GetString();

            var (a, b) = await ConcurrentRequests.SendTogetherAsync(
                () => OrderFixtures.AddDiscountAsync(client, first.AccessToken, id, OrderFixtures.DiscountBody("fixed", 1m, $"First {round}", version)),
                () => OrderFixtures.AddDiscountAsync(client, second.AccessToken, id, OrderFixtures.DiscountBody("fixed", 1m, $"Second {round}", version)));
            using var aResponse = a;
            using var bResponse = b;

            var statuses = new[] { aResponse.StatusCode, bResponse.StatusCode };
            statuses.Count(static status => status == HttpStatusCode.OK).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Count(static status => status == HttpStatusCode.Conflict).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            var stored = await OrderFixtures.ReadDetailAsync(client, first.AccessToken, id);
            stored.GetProperty("discounts").GetArrayLength().ShouldBe(round, $"round {round}: exactly one new discount");
            stored.GetProperty("totals").GetProperty("discount").GetDecimal().ShouldBe(round * 1.00m, $"round {round}");
        }
    }
}
