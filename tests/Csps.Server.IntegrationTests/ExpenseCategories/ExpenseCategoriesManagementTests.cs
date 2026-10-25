using System.Net;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.ExpenseCategories;

/// <summary>
/// CEXP-02, D-08, D-10 to D-15, D-27, OQ-4, OQ-6, OQ-10, T-06-40 to T-06-44: Managers own the category list. They add, rename,
/// recolor, retire, bring back and delete categories; names are unique; Others is protected; a used category can only be retired;
/// every change is audited; an Admin is refused.
/// </summary>
public sealed class ExpenseCategoriesManagementTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AManagerAddsACategoryAndItAppearsInTheListInOrderWithOthersStillLast()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var name = ExpenseCategoryFixtures.UniqueName("Laundry");

        using var response = await ExpenseCategoryFixtures.PostAsync(client, manager.AccessToken, new { name = $" {name} ", tone = "info" });

        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var document = System.Text.Json.JsonDocument.Parse(text);
        var created = document.RootElement;
        created.GetProperty("name").GetString().ShouldBe(name);
        created.GetProperty("tone").GetString().ShouldBe("info");
        created.GetProperty("status").GetString().ShouldBe("active");
        created.GetProperty("isOthers").GetBoolean().ShouldBeFalse();
        created.GetProperty("expenseCount").GetInt32().ShouldBe(0);
        response.Headers.Location.ShouldNotBeNull().ToString().ShouldBe($"/api/v1/expense-categories/{created.GetProperty("id").GetGuid():D}");

        var names = (await ExpenseCategoryFixtures.ReadListAsync(client, manager.AccessToken)).Select(item => item.GetProperty("name").GetString()).ToList();
        names.IndexOf("Government contributions").ShouldBeLessThan(names.IndexOf(name));
        names.IndexOf(name).ShouldBeLessThan(names.IndexOf("Maintenance"));
        names[^1].ShouldBe("Others");
    }

    [Fact]
    public async Task ASecondCategoryWithTheSameNameInAnotherCaseIs400OnName()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var name = ExpenseCategoryFixtures.UniqueName("Dyeing");
        await ExpenseCategoryFixtures.CreateAsync(client, manager.AccessToken, name, "info");

        using var response = await ExpenseCategoryFixtures.PostAsync(client, manager.AccessToken, new { name = $" {name.ToUpperInvariant()} ", tone = "info" });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("expense-categories.invalid-request");
        ExpenseCategoryFixtures.FieldErrors(problem, "name").ShouldBe(["Another category already has this name."]);
    }

    [Fact]
    public async Task ANameOfASeededCategoryIsTakenToo()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await ExpenseCategoryFixtures.PostAsync(client, manager.AccessToken, new { name = "rent", tone = "info" });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseCategoryFixtures.FieldErrors(problem, "name").ShouldBe(["Another category already has this name."]);
    }

    [Fact]
    public async Task AToneOutsideTheSixIs400OnTone()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await ExpenseCategoryFixtures.PostAsync(client, manager.AccessToken, new { name = ExpenseCategoryFixtures.UniqueName("Printing"), tone = "danger" });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseCategoryFixtures.FieldErrors(problem, "tone").ShouldBe(["Choose a badge color."]);
        ExpenseCategoryFixtures.FieldErrors(problem, "name").ShouldBeEmpty();
    }

    [Fact]
    public async Task AMissingBodyListsTheNameAndToneErrors()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await ExpenseCategoryFixtures.PostAsync(client, manager.AccessToken, body: null);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseCategoryFixtures.FieldErrors(problem, "name").ShouldBe(["Enter a category name."]);
        ExpenseCategoryFixtures.FieldErrors(problem, "tone").ShouldBe(["Choose a badge color."]);
    }

    [Fact]
    public async Task AFortyCharacterNameIsAcceptedAndAFortyOneCharacterNameIsNot()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var forty = $"B{Guid.NewGuid():N}".PadRight(40, 'x');

        using var accepted = await ExpenseCategoryFixtures.PostAsync(client, manager.AccessToken, new { name = forty, tone = "info" });
        using var refused = await ExpenseCategoryFixtures.PostAsync(client, manager.AccessToken, new { name = forty + "y", tone = "info" });

        accepted.StatusCode.ShouldBe(HttpStatusCode.Created);
        refused.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(refused, TestContext.Current.CancellationToken);
        ExpenseCategoryFixtures.FieldErrors(problem, "name").ShouldBe(["Keep the name to 40 characters or fewer."]);
    }

    [Fact]
    public async Task AnAdminCannotAddACategoryAndNothingIsWritten()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var name = ExpenseCategoryFixtures.UniqueName("Admin try");

        using var response = await ExpenseCategoryFixtures.PostAsync(client, admin.AccessToken, new { name, tone = "info" });

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        await using var context = database.CreateContext();
        (await context.ExpenseCategories.CountAsync(category => category.Name == name, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AddingWritesOneAuditEntryWithTheNameAndTone()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var name = ExpenseCategoryFixtures.UniqueName("Audited");

        var created = await ExpenseCategoryFixtures.CreateAsync(client, manager.AccessToken, name, "info");

        var key = created.GetProperty("id").GetGuid().ToString("D");
        await using var context = database.CreateContext();
        var entry = await context.AuditLog.AsNoTracking()
            .SingleAsync(row => row.TargetId == key && row.Action == "expense-category.added", TestContext.Current.CancellationToken);
        entry.TargetType.ShouldBe("ExpenseCategory");
        entry.ActorUserId.ShouldBe(manager.UserId);
        entry.Detail.ShouldBe($"name={name};tone=info");
    }

    [Fact]
    public async Task TheRowIsStampedWithTheManagerWhoAddedIt()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        var created = await ExpenseCategoryFixtures.CreateAsync(client, manager.AccessToken, ExpenseCategoryFixtures.UniqueName("Stamped"), "success");

        var id = created.GetProperty("id").GetGuid();
        await using var context = database.CreateContext();
        var row = await context.ExpenseCategories.AsNoTracking().SingleAsync(category => category.Id == id, TestContext.Current.CancellationToken);
        row.CreatedById.ShouldBe(manager.UserId);
        row.UpdatedById.ShouldBeNull();
        row.RowVersion.Length.ShouldBe(8);
    }

    [Fact]
    public async Task TwoAddsWithTheSameNameSentTogetherGiveOneCreatedAndOneNameError()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var m1 = await TestSessions.StartAsync(factory, Roles.Manager);
        var m2 = await TestSessions.StartAsync(factory, Roles.Manager);

        for (var round = 1; round <= 5; round++)
        {
            var name = ExpenseCategoryFixtures.UniqueName($"Race{round}");
            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => ExpenseCategoryFixtures.PostAsync(client, m1.AccessToken, new { name, tone = "info" }),
                () => ExpenseCategoryFixtures.PostAsync(client, m2.AccessToken, new { name = name.ToUpperInvariant(), tone = "warning" }));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
            statuses.Count(static status => status == HttpStatusCode.Created).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Count(static status => status == HttpStatusCode.BadRequest).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            await using var context = database.CreateContext();
            var normalized = name.ToUpperInvariant();
            (await context.ExpenseCategories.CountAsync(category => category.NormalizedName == normalized, TestContext.Current.CancellationToken)).ShouldBe(1, $"round {round}");
        }
    }
}
