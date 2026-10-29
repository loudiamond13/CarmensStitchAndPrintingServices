using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Orders;
using Csps.Testing;

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
