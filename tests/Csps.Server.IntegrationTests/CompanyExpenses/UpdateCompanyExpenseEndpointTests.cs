using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.CompanyExpenses;

/// <summary>CEXP-02, CEXP-04, SEC-07: a staff member edits an expense with the version they opened it with; the next read shows the change.</summary>
public sealed class UpdateCompanyExpenseEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AManagerEditsAnExpenseAndTheNextReadShowsTheChangeANewVersionAndWhoChangedIt()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var recorder = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, recorder.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, recorder.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        var body = ExpenseFixtures.BodyFrom(created);
        body["amount"] = 1250.10m;
        body["description"] = "Thread, needles and chalk";
        var before = TimeProvider.System.GetUtcNow();

        using var response = await ExpenseFixtures.PutAsync(client, manager.AccessToken, id, body);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var saved = document.RootElement;
        saved.GetProperty("id").GetGuid().ShouldBe(id);
        saved.GetProperty("amount").GetDecimal().ShouldBe(1250.10m);
        saved.GetProperty("description").GetString().ShouldBe("Thread, needles and chalk");
        saved.GetProperty("version").GetString().ShouldNotBe(created.GetProperty("version").GetString());
        saved.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        saved.GetProperty("lastChangedAt").GetDateTimeOffset().ShouldBeGreaterThanOrEqualTo(before.AddSeconds(-1));
        saved.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(recorder.UserId);

        var read = await ExpenseFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        read.GetProperty("amount").GetDecimal().ShouldBe(1250.10m);
        read.GetProperty("description").GetString().ShouldBe("Thread, needles and chalk");
        read.GetProperty("version").GetString().ShouldBe(saved.GetProperty("version").GetString());
        read.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
    }

    [Fact]
    public async Task AnUnknownIdAnswers404WithTheDeletedMessage()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var body = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today);
        body["version"] = "AAAAAAAAB9A=";

        using var response = await ExpenseFixtures.PutAsync(client, manager.AccessToken, Guid.NewGuid(), body);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("company-expenses.not-found");
        problem.GetProperty("detail").GetString().ShouldBe("This expense was deleted.");
    }

    [Fact]
    public async Task APutWithNoBodyListsEveryRequiredFieldIncludingTheVersion()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await ExpenseFixtures.PutAsync(client, manager.AccessToken, Guid.NewGuid(), body: null);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("company-expenses.invalid-request");
        ExpenseFixtures.ErrorFields(problem).ShouldBe(["amount", "categoryId", "date", "description", "paidByUserId", "version"]);
        ExpenseFixtures.FieldErrors(problem, "version").ShouldBe(["Reload the form and try again."]);
    }

    [Fact]
    public async Task AnAnonymousCallerGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await ExpenseFixtures.PutAsync(client, accessToken: null, Guid.NewGuid(), body: null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}
