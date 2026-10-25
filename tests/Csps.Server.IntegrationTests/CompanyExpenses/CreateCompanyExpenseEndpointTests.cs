using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

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
}
