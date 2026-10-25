using System.Globalization;
using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Audit;

/// <summary>
/// D-27, AUDIT-02, CEXP-05, 05 D-40: a Manager reads expense and category entries as typed change lines and a snapshot, the payer is
/// Done to, and no description or notes text ever leaves the server. Every test of the class shares one database and finds its own
/// entries by the people it created.
/// </summary>
public sealed class ExpenseAuditViewerTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/audit-log";
    private const string PrivateDescription = "Private order 7731 for Mr Cruz";
    private const string PrivateNotes = "Call him on his own number";

    [Fact]
    public async Task AnAmountEditReadsAsAChangeLineAndAnAddedExpenseAsASnapshotBothDoneToThePayer()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var payer = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var body = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, payer.UserId, today);
        body["amount"] = 1200.00m;
        body["description"] = PrivateDescription;
        body["notes"] = PrivateNotes;
        var created = await ExpenseFixtures.CreateAsync(client, payer.AccessToken, body);
        var edit = ExpenseFixtures.BodyFrom(created);
        edit["amount"] = 1250.00m;
        using (var saved = await ExpenseFixtures.PutAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), edit))
        {
            saved.StatusCode.ShouldBe(HttpStatusCode.OK, await saved.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        var (items, text) = await ReadItemsAsync(client, manager.AccessToken, "pageSize=100");

        var changed = items.Single(item => Action(item) == AuditActions.CompanyExpenseChanged && DoneToId(item) == payer.UserId);
        var changes = changed.GetProperty("changes").EnumerateArray().ToList();
        changes.Count.ShouldBe(1);
        changes[0].GetProperty("field").GetString().ShouldBe("amount");
        changes[0].GetProperty("from").GetString().ShouldBe("1200.00");
        changes[0].GetProperty("to").GetString().ShouldBe("1250.00");
        changed.GetProperty("snapshot").ValueKind.ShouldBe(JsonValueKind.Null);

        var added = items.Single(item => Action(item) == AuditActions.CompanyExpenseAdded && DoneToId(item) == payer.UserId);
        added.GetProperty("changes").GetArrayLength().ShouldBe(0);
        var snapshot = added.GetProperty("snapshot");
        snapshot.GetProperty("date").GetString().ShouldBe(today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        snapshot.GetProperty("category").GetString().ShouldBe("Supplies");
        snapshot.GetProperty("amount").GetDecimal().ShouldBe(1200.00m);
        snapshot.GetProperty("payer").GetProperty("id").GetGuid().ShouldBe(payer.UserId);

        text.ShouldNotContain(PrivateDescription);
        text.ShouldNotContain(PrivateNotes);
    }

    private static string Action(JsonElement item) => item.GetProperty("action").GetString() ?? string.Empty;

    private static Guid? DoneToId(JsonElement item) =>
        item.GetProperty("doneTo") is { ValueKind: JsonValueKind.Object } person ? person.GetProperty("id").GetGuid() : null;

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
