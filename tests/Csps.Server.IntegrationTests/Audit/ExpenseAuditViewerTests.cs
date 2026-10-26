using System.Globalization;
using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Server.IntegrationTests.ExpenseCategories;
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

    [Fact]
    public async Task APayerChangeNamesBothPeopleAndTheDoneToFilterFindsTheOldPayerToo()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var oldPayer = await TestSessions.StartAsync(factory, Roles.Admin);
        var newPayer = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var body = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, oldPayer.UserId, today);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, body);
        var edit = ExpenseFixtures.BodyFrom(created);
        edit["paidByUserId"] = newPayer.UserId;
        edit["notes"] = PrivateNotes;
        using (var saved = await ExpenseFixtures.PutAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), edit))
        {
            saved.StatusCode.ShouldBe(HttpStatusCode.OK, await saved.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        var (items, text) = await ReadItemsAsync(client, manager.AccessToken, "pageSize=100");
        var (aboutOld, _) = await ReadItemsAsync(client, manager.AccessToken, $"target={oldPayer.UserId:D}&pageSize=100");

        var payerChanged = items.Single(item => Action(item) == AuditActions.CompanyExpensePayerChanged && DoneToId(item) == newPayer.UserId);
        var line = payerChanged.GetProperty("changes").EnumerateArray().Single();
        line.GetProperty("field").GetString().ShouldBe("payer");
        line.GetProperty("from").ValueKind.ShouldBe(JsonValueKind.Null);
        line.GetProperty("fromPerson").GetProperty("id").GetGuid().ShouldBe(oldPayer.UserId);
        line.GetProperty("toPerson").GetProperty("id").GetGuid().ShouldBe(newPayer.UserId);
        var changed = items.Single(item => Action(item) == AuditActions.CompanyExpenseChanged && DoneToId(item) == newPayer.UserId);
        changed.GetProperty("changes").EnumerateArray().Select(static change => change.GetProperty("field").GetString()).ShouldBe(["notes"]);
        ExpenseActions(aboutOld).ShouldBe([AuditActions.CompanyExpensePayerChanged, AuditActions.CompanyExpenseAdded]);
        text.ShouldNotContain(PrivateNotes);
    }

    [Fact]
    public async Task ADateAndCategoryEditReadsWithTheCategoryNames()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var payer = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var category = await ExpenseCategoryFixtures.CreateAsync(client, manager.AccessToken, ExpenseCategoryFixtures.UniqueName("Gear"), "info");
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, payer.UserId, today));
        var edit = ExpenseFixtures.BodyFrom(created);
        edit["date"] = today.AddDays(-1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        edit["categoryId"] = category.GetProperty("id").GetGuid();
        using (var saved = await ExpenseFixtures.PutAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), edit))
        {
            saved.StatusCode.ShouldBe(HttpStatusCode.OK, await saved.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        var (items, _) = await ReadItemsAsync(client, manager.AccessToken, "pageSize=100");

        var changed = items.Single(item => Action(item) == AuditActions.CompanyExpenseChanged && DoneToId(item) == payer.UserId);
        var lines = changed.GetProperty("changes").EnumerateArray().ToList();
        lines.Select(static line => line.GetProperty("field").GetString()).ShouldBe(["date", "category"]);
        lines[0].GetProperty("from").GetString().ShouldBe(today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        lines[0].GetProperty("to").GetString().ShouldBe(today.AddDays(-1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        lines[1].GetProperty("from").GetString().ShouldBe("Supplies");
        lines[1].GetProperty("to").GetString().ShouldBe(category.GetProperty("name").GetString());
    }

    [Fact]
    public async Task ACategoryLifeReadsAsNameAndColorLinesWithNobodyAsDoneTo()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var original = ExpenseCategoryFixtures.UniqueName("Fuel");
        var renamed = ExpenseCategoryFixtures.UniqueName("Petrol");
        var created = await ExpenseCategoryFixtures.CreateAsync(client, manager.AccessToken, original, "info");
        var id = created.GetProperty("id").GetGuid();
        await SaveCategoryAsync(client, manager.AccessToken, id, body => body["name"] = renamed);
        await SaveCategoryAsync(client, manager.AccessToken, id, body => body["tone"] = "success");
        using (var retired = await ExpenseCategoryFixtures.RetireAsync(client, manager.AccessToken, id))
        {
            retired.IsSuccessStatusCode.ShouldBeTrue(await retired.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        using (var reactivated = await ExpenseCategoryFixtures.ReactivateAsync(client, manager.AccessToken, id))
        {
            reactivated.IsSuccessStatusCode.ShouldBeTrue(await reactivated.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        using (var deleted = await ExpenseCategoryFixtures.DeleteAsync(client, manager.AccessToken, id))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent, await deleted.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        var (items, _) = await ReadItemsAsync(client, manager.AccessToken, "pageSize=100");

        var categoryEntries = items.Where(item => Action(item).StartsWith("expense-category.", StringComparison.Ordinal)).ToList();
        categoryEntries.ShouldAllBe(item => item.GetProperty("doneTo").ValueKind == JsonValueKind.Null);
        LinesOf(categoryEntries.Single(item => Action(item) == AuditActions.ExpenseCategoryAdded && NameLine(item, null, original)))
            .ShouldBe([("name", null, original), ("tone", null, "info")]);
        LinesOf(categoryEntries.Single(item => Action(item) == AuditActions.ExpenseCategoryRenamed)).ShouldBe([("name", original, renamed)]);
        LinesOf(categoryEntries.Single(item => Action(item) == AuditActions.ExpenseCategoryRecolored)).ShouldBe([("tone", "info", "success")]);
        foreach (var action in new[] { AuditActions.ExpenseCategoryRetired, AuditActions.ExpenseCategoryReactivated, AuditActions.ExpenseCategoryDeleted })
        {
            LinesOf(categoryEntries.Single(item => Action(item) == action && NameLine(item, null, renamed))).ShouldBe([("name", null, renamed)]);
        }
    }

    [Fact]
    public async Task ADeletedCategoryReadsAsNullAndADeletedPayerAsFormerStaff()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var payer = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var gone = await ExpenseCategoryFixtures.CreateAsync(client, manager.AccessToken, ExpenseCategoryFixtures.UniqueName("Gone"), "warning");
        var goneId = gone.GetProperty("id").GetGuid();
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(goneId, payer.UserId, today));
        var edit = ExpenseFixtures.BodyFrom(created);
        edit["categoryId"] = ExpenseFixtures.SuppliesId;
        using (var saved = await ExpenseFixtures.PutAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), edit))
        {
            saved.StatusCode.ShouldBe(HttpStatusCode.OK, await saved.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        using (var deleted = await ExpenseCategoryFixtures.DeleteAsync(client, manager.AccessToken, goneId))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent, await deleted.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        await AccountStateFixtures.MarkDeletedAsync(factory, payer.UserId);

        var (items, _) = await ReadItemsAsync(client, manager.AccessToken, "pageSize=100");

        var added = items.Single(item => Action(item) == AuditActions.CompanyExpenseAdded && DoneToId(item) == payer.UserId);
        added.GetProperty("snapshot").GetProperty("category").ValueKind.ShouldBe(JsonValueKind.Null);
        added.GetProperty("snapshot").GetProperty("payer").GetProperty("formerStaff").GetBoolean().ShouldBeTrue();
        added.GetProperty("doneTo").GetProperty("formerStaff").GetBoolean().ShouldBeTrue();
        var changed = items.Single(item => Action(item) == AuditActions.CompanyExpenseChanged && DoneToId(item) == payer.UserId);
        LinesOf(changed).ShouldBe([("category", null, "Supplies")]);
    }

    [Fact]
    public async Task DeleteRestoreAndPermanentDeleteEachReadAsASnapshotDoneToThePayer()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var payer = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var body = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, payer.UserId, today);
        body["amount"] = 8642.35m;
        var id = (await ExpenseFixtures.CreateAsync(client, manager.AccessToken, body)).GetProperty("id").GetGuid();
        using (var deleted = await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent, await deleted.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        using (var restored = await ExpenseFixtures.RestoreAsync(client, manager.AccessToken, id))
        {
            restored.IsSuccessStatusCode.ShouldBeTrue(await restored.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        using (var removed = await ExpenseFixtures.PermanentDeleteAsync(client, manager.AccessToken, id))
        {
            removed.StatusCode.ShouldBe(HttpStatusCode.NoContent, await removed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        var (items, _) = await ReadItemsAsync(client, manager.AccessToken, "pageSize=100");

        foreach (var action in new[] { AuditActions.CompanyExpenseDeleted, AuditActions.CompanyExpenseRestored, AuditActions.CompanyExpensePermanentlyDeleted })
        {
            var entry = items.Single(item => Action(item) == action && DoneToId(item) == payer.UserId);
            var snapshot = entry.GetProperty("snapshot");
            snapshot.GetProperty("amount").GetDecimal().ShouldBe(8642.35m, action);
            snapshot.GetProperty("category").GetString().ShouldBe("Supplies", action);
            snapshot.GetProperty("payer").GetProperty("id").GetGuid().ShouldBe(payer.UserId, action);
        }
    }

    private static async Task SaveCategoryAsync(HttpClient client, string token, Guid id, Action<Dictionary<string, object?>> change)
    {
        var body = ExpenseCategoryFixtures.BodyFrom(await ExpenseCategoryFixtures.ReadDetailAsync(client, token, id));
        change(body);
        using var response = await ExpenseCategoryFixtures.PutAsync(client, token, id, body);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    private static List<string> ExpenseActions(List<JsonElement> items) =>
        [.. items.Select(Action).Where(action => action.StartsWith("company-expense.", StringComparison.Ordinal))];

    private static List<(string? Field, string? From, string? To)> LinesOf(JsonElement item) =>
        [.. item.GetProperty("changes").EnumerateArray().Select(static line => (
            line.GetProperty("field").GetString(),
            line.GetProperty("from").GetString(),
            line.GetProperty("to").GetString()))];

    private static bool NameLine(JsonElement item, string? from, string to) =>
        LinesOf(item).Contains(("name", from, to));

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
