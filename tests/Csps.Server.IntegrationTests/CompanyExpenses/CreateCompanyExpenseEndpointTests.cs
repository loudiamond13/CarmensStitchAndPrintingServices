using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Expenses;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Users;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.CompanyExpenses;

/// <summary>CEXP-02, CEXP-04, D-01, D-25: a staff member records an expense and reads it back; a stranger is refused.</summary>
public sealed class CreateCompanyExpenseEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AnAdminRecordsAnExpenseAndGets201WithTheDetailAndALocation()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);

        using var response = await ExpenseFixtures.PostAsync(client, admin.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, admin.UserId, today));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        var body = document.RootElement;
        var id = body.GetProperty("id").GetGuid();
        response.Headers.Location.ShouldNotBeNull().ToString().ShouldBe($"/api/v1/company-expenses/{id:D}");
        body.GetProperty("date").GetString().ShouldBe(today.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture));
        body.GetProperty("description").GetString().ShouldBe("Thread and needles");
        body.GetProperty("amount").GetDecimal().ShouldBe(640.00m);
        ExpenseFixtures.IsNull(body, "notes").ShouldBeTrue();
        var category = body.GetProperty("category");
        category.GetProperty("id").GetGuid().ShouldBe(ExpenseFixtures.SuppliesId);
        category.GetProperty("name").GetString().ShouldBe("Supplies");
        category.GetProperty("tone").GetString().ShouldBe("warning");
        category.GetProperty("retired").GetBoolean().ShouldBeFalse();
        var paidBy = body.GetProperty("paidBy");
        paidBy.GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        paidBy.GetProperty("formerStaff").GetBoolean().ShouldBeFalse();
        body.GetProperty("paidByActive").GetBoolean().ShouldBeTrue();
        body.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        body.GetProperty("recordedAt").GetDateTimeOffset().ShouldBeGreaterThan(TimeProvider.System.GetUtcNow().AddMinutes(-5));
        ExpenseFixtures.IsNull(body, "lastChangedBy").ShouldBeTrue();
        ExpenseFixtures.IsNull(body, "lastChangedAt").ShouldBeTrue();
        body.GetProperty("version").GetString().ShouldNotBeNullOrWhiteSpace();
        body.GetProperty("canEdit").GetBoolean().ShouldBeTrue();
    }

    [Fact]
    public async Task AManagerReadsTheSameExpenseByIdAndCanEditIt()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, admin.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, admin.UserId, today));
        var id = created.GetProperty("id").GetGuid();

        var read = await ExpenseFixtures.ReadDetailAsync(client, manager.AccessToken, id);

        read.GetProperty("id").GetGuid().ShouldBe(id);
        read.GetProperty("description").GetString().ShouldBe("Thread and needles");
        read.GetProperty("amount").GetDecimal().ShouldBe(640.00m);
        read.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(admin.UserId);
        read.GetProperty("version").GetString().ShouldBe(created.GetProperty("version").GetString());
        read.GetProperty("canEdit").GetBoolean().ShouldBeTrue();
    }

    [Fact]
    public async Task AnUnknownIdIs404WithTheNotFoundCode()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);

        using var response = await ExpenseFixtures.GetAsync(client, admin.AccessToken, Guid.NewGuid());

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("company-expenses.not-found");
    }

    [Fact]
    public async Task APostWithNoBodyListsEveryRequiredField()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);

        using var response = await ExpenseFixtures.PostAsync(client, admin.AccessToken, body: null);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("company-expenses.invalid-request");
        ExpenseFixtures.ErrorFields(problem).ShouldBe(["amount", "categoryId", "date", "description", "paidByUserId"]);
    }

    [Fact]
    public async Task AnAnonymousPostGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await ExpenseFixtures.PostAsync(client, accessToken: null, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, Guid.NewGuid(), new DateOnly(2026, 10, 25)));

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AnAnonymousGetGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await ExpenseFixtures.GetAsync(client, accessToken: null, Guid.NewGuid());

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Theory]
    [InlineData("deactivated")]
    [InlineData("manager-locked")]
    [InlineData("deleted")]
    [InlineData("invited")]
    public async Task APayerWhoCannotBeChosenIsRefusedOnThePayerFieldWithTheExactMessage(string state)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var payer = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Dee", "Dizon", Roles.Admin, withPassword: state != "invited");
        switch (state)
        {
            case "deactivated":
                await AuthClient.DeactivateAsync(factory, payer.Id);
                break;
            case "manager-locked":
                await AccountStateFixtures.ManagerLockAsync(factory, payer.Id);
                break;
            case "deleted":
                await AccountStateFixtures.MarkDeletedAsync(factory, payer.Id);
                break;
            default:
                break;
        }

        using var response = await ExpenseFixtures.PostAsync(client, admin.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, payer.Id, today));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.FieldErrors(problem, "paidByUserId").ShouldBe(["This person can't be chosen because their account isn't active. Choose someone else."]);
    }

    [Fact]
    public async Task ANonStaffPayerIdIsRefusedOnThePayerField()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);

        using var response = await ExpenseFixtures.PostAsync(client, admin.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, Guid.NewGuid(), today));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.ErrorFields(problem).ShouldBe(["paidByUserId"]);
    }

    [Fact]
    public async Task ARetiredCategoryIsRefusedOnTheCategoryField()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var retiredId = await AddRetiredCategoryAsync();

        using var response = await ExpenseFixtures.PostAsync(client, admin.AccessToken, ExpenseFixtures.ValidBody(retiredId, admin.UserId, today));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.FieldErrors(problem, "categoryId").ShouldBe(["This category was retired. Choose another one."]);
    }

    [Fact]
    public async Task AnUnknownCategoryAndABadAmountAreListedInOneBadRequest()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var body = ExpenseFixtures.ValidBody(Guid.NewGuid(), admin.UserId, today);
        body["amount"] = 0m;

        using var response = await ExpenseFixtures.PostAsync(client, admin.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.ErrorFields(problem).ShouldBe(["amount", "categoryId"]);
        ExpenseFixtures.FieldErrors(problem, "categoryId").ShouldBe(["Choose a category."]);
    }

    [Fact]
    public async Task TheAmountCapIsExactAndTheStoredValueEqualsTheSentValue()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);

        var created = await ExpenseFixtures.CreateAsync(client, admin.AccessToken, WithAmount(admin, today, 1_000_000.00m));
        var cents = await ExpenseFixtures.CreateAsync(client, admin.AccessToken, WithAmount(admin, today, 1250.10m));
        using var overCap = await ExpenseFixtures.PostAsync(client, admin.AccessToken, WithAmount(admin, today, 1_000_000.01m));
        using var tooPrecise = await ExpenseFixtures.PostAsync(client, admin.AccessToken, WithAmount(admin, today, 1250.123m));

        created.GetProperty("amount").GetDecimal().ShouldBe(1_000_000.00m);
        cents.GetProperty("amount").GetDecimal().ShouldBe(1250.10m);
        overCap.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        ExpenseFixtures.FieldErrors(await ProblemJson.ReadAsync(overCap, TestContext.Current.CancellationToken), "amount")
            .ShouldBe(["Enter an amount of ₱1,000,000.00 or less."]);
        tooPrecise.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        ExpenseFixtures.FieldErrors(await ProblemJson.ReadAsync(tooPrecise, TestContext.Current.CancellationToken), "amount")
            .ShouldBe(["Use at most 2 decimal places."]);
        await using var context = database.CreateContext();
        var stored = await context.CompanyExpenses.AsNoTracking()
            .Where(expense => expense.Id == created.GetProperty("id").GetGuid())
            .Select(expense => expense.Amount)
            .SingleAsync(TestContext.Current.CancellationToken);
        stored.ShouldBe(1_000_000.00m);
    }

    [Fact]
    public async Task TheDateWindowEndsThirtyDaysAfterTodayAndEveryLengthLimitIsExact()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);

        (await StatusOfAsync(client, admin, today, body => body["date"] = Iso(today.AddDays(30)))).ShouldBe(HttpStatusCode.Created);
        (await StatusOfAsync(client, admin, today, body => body["date"] = Iso(today.AddDays(31)))).ShouldBe(HttpStatusCode.BadRequest);
        (await StatusOfAsync(client, admin, today, body => body["date"] = Iso(today.AddYears(-5)))).ShouldBe(HttpStatusCode.Created);
        (await StatusOfAsync(client, admin, today, body => body["description"] = new string('d', 200))).ShouldBe(HttpStatusCode.Created);
        (await StatusOfAsync(client, admin, today, body => body["description"] = new string('d', 201))).ShouldBe(HttpStatusCode.BadRequest);
        (await StatusOfAsync(client, admin, today, body => body["notes"] = new string('n', 1000))).ShouldBe(HttpStatusCode.Created);
        (await StatusOfAsync(client, admin, today, body => body["notes"] = new string('n', 1001))).ShouldBe(HttpStatusCode.BadRequest);
        (await StatusOfAsync(client, admin, today, body => body["amount"] = 0.01m)).ShouldBe(HttpStatusCode.Created);
        (await StatusOfAsync(client, admin, today, body => body["amount"] = 0.00m)).ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task TheRecorderMayAlsoBeThePayerAndBothFieldsNameThatPerson()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);

        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));

        created.GetProperty("paidBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        created.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
    }

    private static string Iso(DateOnly date) => date.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);

    private static Dictionary<string, object?> WithAmount(StartedSession caller, DateOnly today, decimal amount)
    {
        var body = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, caller.UserId, today);
        body["amount"] = amount;
        return body;
    }

    private static async Task<HttpStatusCode> StatusOfAsync(HttpClient client, StartedSession caller, DateOnly today, Action<Dictionary<string, object?>> change)
    {
        var body = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, caller.UserId, today);
        change(body);
        using var response = await ExpenseFixtures.PostAsync(client, caller.AccessToken, body);
        return response.StatusCode;
    }

    // A category row of its own, retired at once, so the ten seeded ones stay untouched for the other tests.
    private async Task<Guid> AddRetiredCategoryAsync()
    {
        await using var context = database.CreateContext();
        var row = new ExpenseCategorySeedRow(Guid.NewGuid(), $"Retired {Guid.NewGuid():N}"[..20], "neutral");
        context.ExpenseCategories.Add(ExpenseCategory.FromSeed(row));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        await context.ExpenseCategories.Where(category => category.Id == row.Id)
            .ExecuteUpdateAsync(set => set.SetProperty(category => category.RetiredAtUtc, TimeProvider.System.GetUtcNow()), TestContext.Current.CancellationToken);
        return row.Id;
    }
}
