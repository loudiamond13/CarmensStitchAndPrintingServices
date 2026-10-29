using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.OrderLists;
using Csps.Server.IntegrationTests.Orders;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Audit;

/// <summary>
/// D-31, ORD-16, ORD-22, ORD-23, T-07-56: a Manager reads order, child and list entries as typed change lines with people, list entry
/// names and the order number resolved, and no customer or note text leaves the server. Every test of the class shares one database
/// and finds its own entries by the people it created.
/// </summary>
public sealed class OrderAuditViewerTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/audit-log";

    [Fact]
    public async Task AReceiverChangeReadsWithBothPeopleAndAnAddedPaymentReadsAsLines()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var added = await OrderFixtures.AddPaymentAndReadAsync(client, admin.AccessToken, created, today, 3000m, OrderFixtures.GCashId, admin.UserId);
        var paymentId = added.GetProperty("payments")[0].GetProperty("id").GetGuid();
        using (var changed = await OrderFixtures.PutPaymentAsync(
            client,
            admin.AccessToken,
            id,
            paymentId,
            OrderFixtures.PaymentBody(today, 3000m, OrderFixtures.GCashId, manager.UserId, added.GetProperty("version").GetString())))
        {
            changed.StatusCode.ShouldBe(HttpStatusCode.OK, await changed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        var (items, _) = await ReadItemsAsync(client, manager.AccessToken, "pageSize=100");

        var receiverChanged = items.Single(item => Action(item) == AuditActions.OrderPaymentReceiverChanged && HasPerson(item, "receiver", "toPerson", manager.UserId));
        var line = receiverChanged.GetProperty("changes").EnumerateArray().Single();
        line.GetProperty("field").GetString().ShouldBe("receiver");
        line.GetProperty("fromPerson").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        line.GetProperty("toPerson").GetProperty("id").GetGuid().ShouldBe(manager.UserId);

        var addedEntry = items.Single(item => Action(item) == AuditActions.OrderPaymentAdded && HasPerson(item, "receiver", "toPerson", admin.UserId));
        FieldsOf(addedEntry).ShouldBe(["date", "amount", "method", "receiver"]);
        Line(addedEntry, "amount").GetProperty("to").GetString().ShouldBe("3000.00");
        Line(addedEntry, "method").GetProperty("to").GetString().ShouldBe("GCash");
    }

    [Fact]
    public async Task AStatusMoveAndAReopenReadAsStatusLinesThatNameTheOrder()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var paid = await OrderFixtures.Ord0148PaidInFullAsync(client, admin, manager, today);
        var id = paid.GetProperty("id").GetGuid();
        var number = paid.GetProperty("number").GetString()!;
        await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "ready");
        await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "completed");
        await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "ready");

        var (items, _) = await ReadItemsAsync(client, manager.AccessToken, "pageSize=100");

        var mine = items.Where(item => OrderNumber(item) == number).ToList();
        mine.Where(item => Action(item) == AuditActions.OrderStatusChanged).SelectMany(Lines)
            .ShouldBe([("status", "ready", "completed"), ("status", "pending", "ready")]);
        mine.Where(item => Action(item) == AuditActions.OrderReopened).SelectMany(Lines).ShouldBe([("status", "completed", "ready")]);
        Lines(mine.Single(item => Action(item) == AuditActions.OrderCreated)).ShouldBe(
        [
            ("status", null, "pending"),
            ("orderDate", null, OrderFixtures.Date(today)),
            ("dueDate", null, OrderFixtures.Date(today.AddDays(14))),
        ]);
    }

    [Fact]
    public async Task AnOrderExpensePayerChangeNamesBothPeopleAndTheCategory()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var added = await OrderFixtures.AddExpenseAndReadAsync(client, admin.AccessToken, created, today, OrderFixtures.FabricId, 500m, admin.UserId, "Private fabric note");
        var expenseId = added.GetProperty("expenses")[0].GetProperty("id").GetGuid();
        using (var changed = await OrderFixtures.PutExpenseAsync(
            client,
            admin.AccessToken,
            id,
            expenseId,
            OrderFixtures.ExpenseBody(today, OrderFixtures.InkAndPaperId, "Private fabric note", 450m, manager.UserId, added.GetProperty("version").GetString())))
        {
            changed.StatusCode.ShouldBe(HttpStatusCode.OK, await changed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        var (items, text) = await ReadItemsAsync(client, manager.AccessToken, "pageSize=100");

        var payerChanged = items.Single(item => Action(item) == AuditActions.OrderExpensePayerChanged && HasPerson(item, "payer", "toPerson", manager.UserId));
        var line = payerChanged.GetProperty("changes").EnumerateArray().Single();
        line.GetProperty("fromPerson").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        OrderNumber(payerChanged).ShouldBe(created.GetProperty("number").GetString());
        var addedEntry = items.Single(item => Action(item) == AuditActions.OrderExpenseAdded && HasPerson(item, "payer", "toPerson", admin.UserId));
        FieldsOf(addedEntry).ShouldBe(["date", "amount", "category", "payer"]);
        Line(addedEntry, "category").GetProperty("to").GetString().ShouldBe("Fabric");
        var changedEntry = items.Single(item => Action(item) == AuditActions.OrderExpenseChanged && Lines(item).Any(change => change.Field == "amount" && change.To == "450.00"));
        Lines(changedEntry).ShouldBe([("amount", "500.00", "450.00"), ("category", "Fabric", "Ink & paper")]);
        text.ShouldNotContain("Private fabric note");
    }

    [Fact]
    public async Task AnItemAndADiscountReadWithProductTypeNamesKindsAndPercentValues()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        var itemId = created.GetProperty("items")[0].GetProperty("id").GetGuid();
        var withDiscount = await OrderFixtures.AddDiscountAndReadAsync(client, manager.AccessToken, created, "percentage", 5m);
        var discountId = withDiscount.GetProperty("discounts")[0].GetProperty("id").GetGuid();
        using (var itemSaved = await OrderFixtures.PutItemAsync(
            client,
            manager.AccessToken,
            id,
            itemId,
            OrderFixtures.ItemBody(OrderFixtures.PoloId, withDiscount.GetProperty("version").GetString(), "Jersey top", "S-XL", 20, 650.00m)))
        {
            itemSaved.StatusCode.ShouldBe(HttpStatusCode.OK, await itemSaved.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        var afterItem = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        using (var discountSaved = await OrderFixtures.PutDiscountAsync(
            client,
            manager.AccessToken,
            id,
            discountId,
            OrderFixtures.DiscountBody("percentage", 10m, "Barangay league discount", afterItem.GetProperty("version").GetString())))
        {
            discountSaved.StatusCode.ShouldBe(HttpStatusCode.OK, await discountSaved.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        var (items, _) = await ReadItemsAsync(client, manager.AccessToken, "pageSize=100");

        var number = created.GetProperty("number").GetString();
        var mine = items.Where(item => OrderNumber(item) == number).ToList();
        Lines(mine.Single(item => Action(item) == AuditActions.OrderItemChanged)).ShouldBe(
            [("productType", "Basketball Jersey", "Polo Shirt"), ("quantity", "15", "20")]);
        Lines(mine.Single(item => Action(item) == AuditActions.OrderDiscountAdded)).ShouldBe([("kind", null, "percentage"), ("value", null, "5.00%")]);
        Lines(mine.Single(item => Action(item) == AuditActions.OrderDiscountChanged)).ShouldBe([("value", "5.00%", "10.00%")]);
    }

    [Fact]
    public async Task AProductTypeRenameReadsTheOldAndNewName()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var original = OrderListFixtures.UniqueName("Hoodie");
        var renamed = OrderListFixtures.UniqueName("Jacket");
        var entry = await OrderListFixtures.CreateAsync(client, OrderListFixtures.ProductTypes, manager.AccessToken, original, "info");
        var body = OrderListFixtures.BodyFrom(entry);
        body["name"] = renamed;
        using (var saved = await OrderListFixtures.PutAsync(client, OrderListFixtures.ProductTypes, manager.AccessToken, entry.GetProperty("id").GetGuid(), body))
        {
            saved.StatusCode.ShouldBe(HttpStatusCode.OK, await saved.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        var (items, _) = await ReadItemsAsync(client, manager.AccessToken, "pageSize=100");

        Lines(items.Single(item => Action(item) == AuditActions.ProductTypeRenamed && Lines(item).Contains(("name", original, renamed))))
            .ShouldBe([("name", original, renamed)]);
        Lines(items.Single(item => Action(item) == AuditActions.ProductTypeAdded && Lines(item).Contains(("name", null, original))))
            .ShouldBe([("name", null, original), ("tone", null, "info")]);
    }

    [Fact]
    public async Task ARetiredPaymentMethodStillReadsByName()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var methodId = await OrderFixtures.AddPaymentMethodAsync(database, retired: false);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        await OrderFixtures.AddPaymentAndReadAsync(client, manager.AccessToken, created, today, 200m, methodId, manager.UserId);
        await OrderFixtures.RetirePaymentMethodAsync(database, methodId);
        string name;
        await using (var context = database.CreateContext())
        {
            name = await context.PaymentMethods.AsNoTracking().Where(method => method.Id == methodId).Select(method => method.Name).SingleAsync(TestContext.Current.CancellationToken);
        }

        var (items, _) = await ReadItemsAsync(client, manager.AccessToken, "pageSize=100");

        var added = items.Single(item => Action(item) == AuditActions.OrderPaymentAdded && OrderNumber(item) == created.GetProperty("number").GetString());
        Line(added, "method").GetProperty("to").GetString().ShouldBe(name);
    }

    [Fact]
    public async Task ADeletedRestoredAndPermanentlyDeletedOrderEachShowAnOrderSnapshotEvenAfterTheRowIsGone()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var order = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.Ord0148FullBody(today, admin.UserId, manager.UserId));
        var id = order.GetProperty("id").GetGuid();
        var number = order.GetProperty("number").GetString()!;
        using (var deleted = await OrderFixtures.DeleteAsync(client, admin.AccessToken, id))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using (var restored = await OrderFixtures.RestoreAsync(client, manager.AccessToken, id))
        {
            restored.IsSuccessStatusCode.ShouldBeTrue();
        }

        using (var removed = await OrderFixtures.PermanentlyDeleteAsync(client, manager.AccessToken, id, number))
        {
            removed.StatusCode.ShouldBe(HttpStatusCode.NoContent, await removed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        var (items, _) = await ReadItemsAsync(client, manager.AccessToken, "pageSize=100");

        foreach (var action in new[] { AuditActions.OrderDeleted, AuditActions.OrderRestored, AuditActions.OrderPermanentlyDeleted })
        {
            var entry = items.Single(item => Action(item) == action && OrderNumber(item) == number);
            var snapshot = entry.GetProperty("orderSnapshot");
            snapshot.GetProperty("number").GetString().ShouldBe(number, action);
            snapshot.GetProperty("status").GetString().ShouldBe("pending", action);
            snapshot.GetProperty("total").GetDecimal().ShouldBe(21327.50m, action);
            snapshot.GetProperty("paid").GetDecimal().ShouldBe(12000.00m, action);
            snapshot.GetProperty("balance").GetDecimal().ShouldBe(9327.50m, action);
            entry.GetProperty("changes").GetArrayLength().ShouldBe(0, action);
        }

        items.Where(item => Action(item) == AuditActions.OrderCreated).Single(item => OrderNumber(item) == number)
            .GetProperty("orderSnapshot").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task AnEntryNamingTheLegacyHolderReadsLegacyUnassigned()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var detail = $"payment={Guid.NewGuid():D};date=2026-10-25;amount=100.00;method={OrderFixtures.CashId:D};receiver={LegacyHolder.Id:D}";
        await using (var context = database.CreateContext())
        {
            context.AuditLog.Add(AuditEntry.Create(
                TimeProvider.System.GetUtcNow(), manager.UserId, AuditActions.OrderPaymentAdded, "Order", Guid.NewGuid().ToString("D"), null, null, Guid.NewGuid().ToString("N"), detail));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var (items, _) = await ReadItemsAsync(client, manager.AccessToken, "pageSize=100");

        var entry = items.Single(item => item.GetProperty("detail").GetString() == detail);
        Line(entry, "receiver").GetProperty("toPerson").GetProperty("name").GetString().ShouldBe("Legacy / unassigned");
        Line(entry, "method").GetProperty("to").GetString().ShouldBe("Cash");
        entry.GetProperty("orderNumber").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task NoCustomerOrNoteTextLeavesTheServerOnlyTheNamesOfTheFieldsThatChanged()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["customerName"] = "Private Customer 7731";
        body["notes"] = "Private note 7731";
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, body);
        var edit = OrderFixtures.DetailsBodyFrom(created);
        edit["customerName"] = "Private Customer 9912";
        edit["notes"] = "Another private note 9912";
        using (var saved = await OrderFixtures.PutDetailsAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), edit))
        {
            saved.StatusCode.ShouldBe(HttpStatusCode.OK, await saved.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        var (items, text) = await ReadItemsAsync(client, manager.AccessToken, "pageSize=100");

        var changed = items.Single(item => Action(item) == AuditActions.OrderChanged && OrderNumber(item) == created.GetProperty("number").GetString());
        Lines(changed).ShouldBe([("customerName", null, null), ("notes", null, null)]);
        text.ShouldNotContain("Private");
    }

    private static string? OrderNumber(JsonElement item) =>
        item.GetProperty("orderNumber") is { ValueKind: JsonValueKind.String } number ? number.GetString() : null;

    private static List<(string? Field, string? From, string? To)> Lines(JsonElement item) =>
        [.. item.GetProperty("changes").EnumerateArray().Select(static line => (
            line.GetProperty("field").GetString(),
            line.GetProperty("from").GetString(),
            line.GetProperty("to").GetString()))];

    private static bool HasPerson(JsonElement item, string field, string side, Guid userId) =>
        item.GetProperty("changes").EnumerateArray().Any(line =>
            line.GetProperty("field").GetString() == field
            && line.GetProperty(side) is { ValueKind: JsonValueKind.Object } person
            && person.GetProperty("id").GetGuid() == userId);

    private static List<string?> FieldsOf(JsonElement item) =>
        [.. item.GetProperty("changes").EnumerateArray().Select(static line => line.GetProperty("field").GetString())];

    private static JsonElement Line(JsonElement item, string field) =>
        item.GetProperty("changes").EnumerateArray().Single(line => line.GetProperty("field").GetString() == field);

    private static string Action(JsonElement item) => item.GetProperty("action").GetString() ?? string.Empty;

    private static async Task<(List<JsonElement> Items, string Text)> ReadItemsAsync(HttpClient client, string token, string query)
    {
        using var request = ApiRequests.Get(query.Length == 0 ? Route : $"{Route}?{query}", token);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return ([.. document.RootElement.GetProperty("items").EnumerateArray().Select(static item => item.Clone())], text);
    }
}
