using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Testing;

/// <summary>
/// QUAL-05, D-37: <c>POST /api/testing/expenses</c> lets E2E specs seed expenses with a chosen payer, recorder, date and delete state, in the
/// Testing environment of a Debug build only. The stored recorder is the requested one even though the testing caller is anonymous.
/// </summary>
public sealed class TestingExpensesTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/testing/expenses";

    [Fact]
    public async Task APostCreatesTheExpenseAndTheListShowsItsPayerAndRecorder()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var payer = await TestSessions.StartAsync(factory, Roles.Admin);
        var recorder = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);

        var id = await CreateAsync(client, Body(payer.UserId, recorder.UserId, today, "Seeded ribbon"));

        var page = await ExpenseFixtures.ReadPageAsync(client, payer.AccessToken, "q=Seeded%20ribbon");
        var item = page.Items.ShouldHaveSingleItem();
        item.Id.ShouldBe(id);
        item.PaidBy.Id.ShouldBe(payer.UserId);
        item.RecordedBy.ShouldNotBeNull().Id.ShouldBe(recorder.UserId);
        item.Date.ShouldBe(today);
        item.Amount.ShouldBe(125.50m);
    }

    [Fact]
    public async Task TheStoredRecorderIsTheRequestedOneEvenThoughTheCallerIsAnonymous()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var payer = await TestSessions.StartAsync(factory, Roles.Admin);
        var recorder = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);

        var id = await CreateAsync(client, Body(payer.UserId, recorder.UserId, today, "Recorder stamp"));

        await using var context = database.CreateContext();
        var row = await context.CompanyExpenses.AsNoTracking().SingleAsync(expense => expense.Id == id, TestContext.Current.CancellationToken);
        row.CreatedById.ShouldBe(recorder.UserId);
        row.PaidByUserId.ShouldBe(payer.UserId);
        row.DeletedAtUtc.ShouldBeNull();
    }

    [Fact]
    public async Task WithNoRecorderTheExpenseIsRecordedBySystem()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var payer = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var body = Body(payer.UserId, recordedBy: null, today, "System row");

        var id = await CreateAsync(client, body);

        await using var context = database.CreateContext();
        var row = await context.CompanyExpenses.AsNoTracking().SingleAsync(expense => expense.Id == id, TestContext.Current.CancellationToken);
        row.CreatedById.ShouldBeNull();
    }

    [Fact]
    public async Task ADeletedExpenseIsSoftDeletedByTheRecorderAndAbsentFromTheList()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var payer = await TestSessions.StartAsync(factory, Roles.Admin);
        var recorder = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var body = Body(payer.UserId, recorder.UserId, today, "Deleted seed");
        body["deleted"] = true;

        var id = await CreateAsync(client, body);

        var page = await ExpenseFixtures.ReadPageAsync(client, payer.AccessToken, "q=Deleted%20seed");
        page.Items.ShouldBeEmpty();
        await using var context = database.CreateContext();
        var row = await context.CompanyExpenses.IgnoreQueryFilters(["SoftDelete"]).AsNoTracking().SingleAsync(expense => expense.Id == id, TestContext.Current.CancellationToken);
        row.DeletedAtUtc.ShouldNotBeNull();
        row.DeletedById.ShouldBe(recorder.UserId);
        row.CreatedById.ShouldBe(recorder.UserId);
    }

    [Fact]
    public async Task ANotesValueIsStored()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var payer = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var body = Body(payer.UserId, payer.UserId, today, "With notes");
        body["notes"] = "Kept for the detail view";

        var id = await CreateAsync(client, body);

        await using var context = database.CreateContext();
        var row = await context.CompanyExpenses.AsNoTracking().SingleAsync(expense => expense.Id == id, TestContext.Current.CancellationToken);
        row.Notes.ShouldBe("Kept for the detail view");
    }

    [Fact]
    public async Task NoBodyIs400()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.PostAsync(new Uri(Route, UriKind.Relative), null, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("status").GetInt32().ShouldBe(400);
    }

    [Fact]
    public async Task AnUnparseableBodyIs400()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var content = new StringContent("not json", Encoding.UTF8, "application/json");

        using var response = await client.PostAsync(new Uri(Route, UriKind.Relative), content, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AnUnknownPayerIs400OnThePayerField()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var today = await ExpenseFixtures.TodayAsync(factory);

        using var response = await client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), Body(Guid.NewGuid(), recordedBy: null, today, "Nobody"), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.ErrorFields(problem).ShouldBe(["paidByUserId"]);
    }

    [Fact]
    public async Task ARuleBrokenByTheDomainIs400OnItsField()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var payer = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var body = Body(payer.UserId, payer.UserId, today, "Free stuff");
        body["amount"] = 0m;

        using var response = await client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), body, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.ErrorFields(problem).ShouldBe(["amount"]);
    }

    [Fact]
    public async Task EveryMissingFieldIsListedTogether()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), new { }, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.ErrorFields(problem).ShouldBe(["amount", "categoryId", "date", "description", "paidByUserId"]);
    }

    private static Dictionary<string, object?> Body(Guid paidBy, Guid? recordedBy, DateOnly date, string description) => new()
    {
        ["paidByUserId"] = paidBy,
        ["recordedByUserId"] = recordedBy,
        ["date"] = date.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture),
        ["categoryId"] = ExpenseFixtures.SuppliesId,
        ["description"] = description,
        ["amount"] = 125.50m,
    };

    private static async Task<Guid> CreateAsync(HttpClient client, Dictionary<string, object?> body)
    {
        using var response = await client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), body, TestContext.Current.CancellationToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.GetProperty("id").GetGuid();
    }
}
