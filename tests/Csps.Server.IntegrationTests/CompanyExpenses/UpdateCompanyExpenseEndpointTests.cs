using System.Globalization;
using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Expenses;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

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

    [Fact]
    public async Task AnAdminWhoRecordedTheExpenseMayEditIt()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var payer = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, admin.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, payer.UserId, today));
        var body = ExpenseFixtures.BodyFrom(created);
        body["amount"] = 801m;

        using var response = await ExpenseFixtures.PutAsync(client, admin.AccessToken, created.GetProperty("id").GetGuid(), body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task AnAdminWhoIsThePayerMayEditAnExpenseSomeoneElseRecorded()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, admin.UserId, today));
        var body = ExpenseFixtures.BodyFrom(created);
        body["description"] = "Thread, again";

        using var response = await ExpenseFixtures.PutAsync(client, admin.AccessToken, created.GetProperty("id").GetGuid(), body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task AnAdminWhoNeitherRecordedNorPaidGets403WithTheExactMessageAndNothingChanges()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var stranger = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        var body = ExpenseFixtures.BodyFrom(created);
        body["amount"] = 1m;

        using var response = await ExpenseFixtures.PutAsync(client, stranger.AccessToken, id, body);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("company-expenses.not-yours");
        problem.GetProperty("detail").GetString().ShouldBe("Admins can edit only the expenses they recorded or paid. Ask a Manager to change it.");
        var stored = await ExpenseFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("amount").GetDecimal().ShouldBe(640.00m);
        stored.GetProperty("version").GetString().ShouldBe(created.GetProperty("version").GetString());
    }

    [Fact]
    public async Task AManagerMayEditAnyonesExpense()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, admin.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, admin.UserId, today));
        var body = ExpenseFixtures.BodyFrom(created);
        body["amount"] = 55m;

        using var response = await ExpenseFixtures.PutAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task AnAdminWhoMovesThePayerAwayFromThemselvesLosesTheRightToEditIt()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, admin.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        var move = ExpenseFixtures.BodyFrom(created);
        move["paidByUserId"] = manager.UserId;

        using var moved = await ExpenseFixtures.PutAsync(client, admin.AccessToken, id, move);
        var movedText = await moved.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        moved.StatusCode.ShouldBe(HttpStatusCode.OK, movedText);
        using var document = JsonDocument.Parse(movedText);
        document.RootElement.GetProperty("canEdit").GetBoolean().ShouldBeFalse();
        var page = await ExpenseFixtures.ReadPageAsync(client, admin.AccessToken);
        page.Items.Single(row => row.Id == id).CanEdit.ShouldBeFalse();
        var again = ExpenseFixtures.BodyFrom(document.RootElement);
        again["amount"] = 3m;
        using var next = await ExpenseFixtures.PutAsync(client, admin.AccessToken, id, again);
        next.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ASoftDeletedExpenseAnswers404()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        await using (var context = database.CreateContext())
        {
            await context.CompanyExpenses.Where(expense => expense.Id == id)
                .ExecuteUpdateAsync(set => set.SetProperty(expense => expense.DeletedAtUtc, TimeProvider.System.GetUtcNow()), TestContext.Current.CancellationToken);
        }

        using var response = await ExpenseFixtures.PutAsync(client, manager.AccessToken, id, ExpenseFixtures.BodyFrom(created));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("company-expenses.not-found");
        problem.GetProperty("detail").GetString().ShouldBe("This expense was deleted.");
    }

    [Theory]
    [InlineData("AAAAAAAAAA==")]
    [InlineData("not base64!")]
    [InlineData("")]
    public async Task AVersionThatIsNotEightBytesIsRefusedOnTheVersionField(string version)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var body = ExpenseFixtures.BodyFrom(created);
        body["version"] = version;

        using var response = await ExpenseFixtures.PutAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.ErrorFields(problem).ShouldBe(["version"]);
        ExpenseFixtures.FieldErrors(problem, "version").ShouldBe(["Reload the form and try again."]);
    }

    [Fact]
    public async Task AnEditAppliesTheSameFieldRulesAndMessagesAsTheAddForm()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var body = ExpenseFixtures.BodyFrom(created);
        body["amount"] = 1000000.01m;
        body["description"] = " ";
        body["date"] = today.AddDays(31).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        using var response = await ExpenseFixtures.PutAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.ErrorFields(problem).ShouldBe(["amount", "date", "description"]);
        ExpenseFixtures.FieldErrors(problem, "amount").ShouldBe([ExpenseRules.AmountTooLarge]);
        ExpenseFixtures.FieldErrors(problem, "description").ShouldBe([ExpenseRules.DescriptionRequired]);
    }

    [Fact]
    public async Task SavingTheFormUnchangedReturnsTheSameVersionAndChangesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));

        using var response = await ExpenseFixtures.PutAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), ExpenseFixtures.BodyFrom(created));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        document.RootElement.GetProperty("version").GetString().ShouldBe(created.GetProperty("version").GetString());
        ExpenseFixtures.IsNull(document.RootElement, "lastChangedBy").ShouldBeTrue();
    }
}
