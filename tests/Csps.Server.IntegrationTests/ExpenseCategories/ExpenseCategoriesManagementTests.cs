using System.Net;
using Csps.Application.Security;
using Csps.Domain.Expenses;
using Csps.Server.IntegrationTests.CompanyExpenses;
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
    private static readonly Guid RentId = ExpenseCategorySeed.Rows.Single(row => row.Name == "Rent").Id;

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

    [Fact]
    public async Task AManagerReadsASeededCategoryWithItsStatusCountAndSystemAsRecorder()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        var detail = await ExpenseCategoryFixtures.ReadDetailAsync(client, manager.AccessToken, RentId);

        detail.GetProperty("id").GetGuid().ShouldBe(RentId);
        detail.GetProperty("name").GetString().ShouldBe("Rent");
        detail.GetProperty("tone").GetString().ShouldBe("accent");
        detail.GetProperty("status").GetString().ShouldBe("active");
        detail.GetProperty("isOthers").GetBoolean().ShouldBeFalse();
        detail.GetProperty("expenseCount").GetInt32().ShouldBe(0);
        ExpenseFixtures.IsNull(detail, "recordedBy").ShouldBeTrue();
        ExpenseFixtures.IsNull(detail, "lastChangedBy").ShouldBeTrue();
        ExpenseFixtures.IsNull(detail, "lastChangedAt").ShouldBeTrue();
        detail.GetProperty("recordedAt").GetDateTimeOffset().ShouldBe(ExpenseCategorySeed.SeededAtUtc);
        Convert.FromBase64String(detail.GetProperty("version").GetString().ShouldNotBeNull()).Length.ShouldBe(8);
    }

    [Fact]
    public async Task ACategoryAManagerAddedNamesThatManagerAsTheRecorder()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await ExpenseCategoryFixtures.CreateAsync(client, manager.AccessToken, ExpenseCategoryFixtures.UniqueName("Recorded"), "info");

        var detail = await ExpenseCategoryFixtures.ReadDetailAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid());

        detail.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        detail.GetProperty("recordedBy").GetProperty("formerStaff").GetBoolean().ShouldBeFalse();
        ExpenseFixtures.IsNull(detail, "lastChangedBy").ShouldBeTrue();
    }

    [Fact]
    public async Task ReadingAnUnknownCategoryIs404AndAnAdminIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);

        using var unknown = await ExpenseCategoryFixtures.GetAsync(client, manager.AccessToken, Guid.NewGuid());
        using var refused = await ExpenseCategoryFixtures.GetAsync(client, admin.AccessToken, RentId);

        unknown.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(unknown, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("expense-categories.not-found");
        refused.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ARenameAndRecolorShowOnEveryExpenseWithANewVersionAndTwoAuditRows()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var oldName = ExpenseCategoryFixtures.UniqueName("Stationery");
        var newName = ExpenseCategoryFixtures.UniqueName("Office");
        var category = await ExpenseCategoryFixtures.CreateAsync(client, manager.AccessToken, oldName, "warning");
        var id = category.GetProperty("id").GetGuid();
        var label = $"Rename {Guid.NewGuid():N}";
        var expenseBody = ExpenseFixtures.ValidBody(id, manager.UserId, today);
        expenseBody["description"] = label;
        var expense = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, expenseBody);
        var before = await ExpenseCategoryFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        var body = ExpenseCategoryFixtures.BodyFrom(before);
        body["name"] = $" {newName} ";
        body["tone"] = "success";

        using var response = await ExpenseCategoryFixtures.PutAsync(client, manager.AccessToken, id, body);

        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = System.Text.Json.JsonDocument.Parse(text);
        var saved = document.RootElement;
        saved.GetProperty("name").GetString().ShouldBe(newName);
        saved.GetProperty("tone").GetString().ShouldBe("success");
        saved.GetProperty("expenseCount").GetInt32().ShouldBe(1);
        saved.GetProperty("version").GetString().ShouldNotBe(before.GetProperty("version").GetString());
        saved.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        ExpenseFixtures.IsNull(saved, "lastChangedAt").ShouldBeFalse();

        var page = await ExpenseFixtures.ReadPageAsync(client, manager.AccessToken, $"q={label}");
        page.Items.ShouldHaveSingleItem().Category.ShouldBe(new ListedCategory(id, newName, "success", Retired: false));
        var detail = await ExpenseFixtures.ReadDetailAsync(client, manager.AccessToken, expense.GetProperty("id").GetGuid());
        detail.GetProperty("category").GetProperty("name").GetString().ShouldBe(newName);
        detail.GetProperty("category").GetProperty("tone").GetString().ShouldBe("success");

        var key = id.ToString("D");
        await using var context = database.CreateContext();
        var audits = await context.AuditLog.AsNoTracking()
            .Where(row => row.TargetId == key && row.Action != "expense-category.added")
            .OrderBy(row => row.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
        audits.Select(row => (row.Action, row.Detail, row.ActorUserId, row.TargetType)).ShouldBe(
        [
            ("expense-category.renamed", $"name={oldName}>{newName}", (Guid?)manager.UserId, (string?)"ExpenseCategory"),
            ("expense-category.recolored", "tone=warning>success", (Guid?)manager.UserId, (string?)"ExpenseCategory"),
        ]);
    }

    [Fact]
    public async Task ARenameAloneOrARecolorAloneWritesOnlyItsOwnAuditRow()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var name = ExpenseCategoryFixtures.UniqueName("Single");
        var created = await ExpenseCategoryFixtures.CreateAsync(client, manager.AccessToken, name, "info");
        var id = created.GetProperty("id").GetGuid();
        var firstBody = ExpenseCategoryFixtures.BodyFrom(await ExpenseCategoryFixtures.ReadDetailAsync(client, manager.AccessToken, id));
        firstBody["name"] = name.ToLowerInvariant();
        using (var rename = await ExpenseCategoryFixtures.PutAsync(client, manager.AccessToken, id, firstBody))
        {
            rename.StatusCode.ShouldBe(HttpStatusCode.OK, await rename.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        var secondBody = ExpenseCategoryFixtures.BodyFrom(await ExpenseCategoryFixtures.ReadDetailAsync(client, manager.AccessToken, id));
        secondBody["tone"] = "mockup";
        using (var recolor = await ExpenseCategoryFixtures.PutAsync(client, manager.AccessToken, id, secondBody))
        {
            recolor.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        var key = id.ToString("D");
        await using var context = database.CreateContext();
        var audits = await context.AuditLog.AsNoTracking()
            .Where(row => row.TargetId == key && row.Action != "expense-category.added")
            .OrderBy(row => row.Id)
            .Select(row => new { row.Action, row.Detail })
            .ToListAsync(TestContext.Current.CancellationToken);
        audits.Select(row => (row.Action, row.Detail)).ShouldBe(
        [
            ("expense-category.renamed", (string?)$"name={name}>{name.ToLowerInvariant()}"),
            ("expense-category.recolored", (string?)"tone=info>mockup"),
        ]);
    }

    [Fact]
    public async Task ASaveWithAnOldVersionIs409EditStaleAndChangesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var name = ExpenseCategoryFixtures.UniqueName("Stale");
        var created = await ExpenseCategoryFixtures.CreateAsync(client, manager.AccessToken, name, "info");
        var id = created.GetProperty("id").GetGuid();
        var opened = ExpenseCategoryFixtures.BodyFrom(await ExpenseCategoryFixtures.ReadDetailAsync(client, manager.AccessToken, id));
        var colleague = new Dictionary<string, object?>(opened) { ["tone"] = "success" };
        using (var first = await ExpenseCategoryFixtures.PutAsync(client, manager.AccessToken, id, colleague))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        var late = new Dictionary<string, object?>(opened) { ["name"] = ExpenseCategoryFixtures.UniqueName("Late"), ["tone"] = "warning" };

        using var response = await ExpenseCategoryFixtures.PutAsync(client, manager.AccessToken, id, late);

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("edit.stale");
        var current = await ExpenseCategoryFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        current.GetProperty("name").GetString().ShouldBe(name);
        current.GetProperty("tone").GetString().ShouldBe("success");
    }

    [Fact]
    public async Task TwoSavesWithOneVersionSentTogetherGiveOneOkAndOneConflict()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var m1 = await TestSessions.StartAsync(factory, Roles.Manager);
        var m2 = await TestSessions.StartAsync(factory, Roles.Manager);

        for (var round = 1; round <= 5; round++)
        {
            var created = await ExpenseCategoryFixtures.CreateAsync(client, m1.AccessToken, ExpenseCategoryFixtures.UniqueName($"Two{round}"), "info");
            var id = created.GetProperty("id").GetGuid();
            var opened = ExpenseCategoryFixtures.BodyFrom(await ExpenseCategoryFixtures.ReadDetailAsync(client, m1.AccessToken, id));
            var forFirst = new Dictionary<string, object?>(opened) { ["tone"] = "success" };
            var forSecond = new Dictionary<string, object?>(opened) { ["tone"] = "warning" };

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => ExpenseCategoryFixtures.PutAsync(client, m1.AccessToken, id, forFirst),
                () => ExpenseCategoryFixtures.PutAsync(client, m2.AccessToken, id, forSecond));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
            statuses.Count(static status => status == HttpStatusCode.OK).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Count(static status => status == HttpStatusCode.Conflict).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
        }
    }

    [Fact]
    public async Task OthersCannotBeRenamedButCanBeRecolored()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var othersId = ExpenseCategorySeed.OthersId;
        var opened = ExpenseCategoryFixtures.BodyFrom(await ExpenseCategoryFixtures.ReadDetailAsync(client, manager.AccessToken, othersId));
        var rename = new Dictionary<string, object?>(opened) { ["name"] = "Misc" };

        using var refused = await ExpenseCategoryFixtures.PutAsync(client, manager.AccessToken, othersId, rename);

        refused.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(refused, TestContext.Current.CancellationToken);
        ExpenseCategoryFixtures.FieldErrors(problem, "name").ShouldBe(["The Others name can't change."]);

        var recolor = new Dictionary<string, object?>(opened) { ["tone"] = "success" };
        using var recolored = await ExpenseCategoryFixtures.PutAsync(client, manager.AccessToken, othersId, recolor);
        recolored.StatusCode.ShouldBe(HttpStatusCode.OK, await recolored.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var after = ExpenseCategoryFixtures.BodyFrom(await ExpenseCategoryFixtures.ReadDetailAsync(client, manager.AccessToken, othersId));
        after["tone"] = "neutral";
        using var restored = await ExpenseCategoryFixtures.PutAsync(client, manager.AccessToken, othersId, after);
        restored.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ExpenseCategoryFixtures.ReadDetailAsync(client, manager.AccessToken, othersId)).GetProperty("name").GetString().ShouldBe("Others");
    }

    [Fact]
    public async Task RenamingToAnotherCategorysNameInAnotherCaseIs400OnName()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await ExpenseCategoryFixtures.CreateAsync(client, manager.AccessToken, ExpenseCategoryFixtures.UniqueName("Mover"), "info");
        var id = created.GetProperty("id").GetGuid();
        var body = ExpenseCategoryFixtures.BodyFrom(await ExpenseCategoryFixtures.ReadDetailAsync(client, manager.AccessToken, id));
        body["name"] = "gOVERNMENT CONTRIBUTIONS";

        using var response = await ExpenseCategoryFixtures.PutAsync(client, manager.AccessToken, id, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseCategoryFixtures.FieldErrors(problem, "name").ShouldBe(["Another category already has this name."]);
    }

    [Fact]
    public async Task ASaveWithNothingChangedIs200WithTheSameVersionAndWritesNoAudit()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await ExpenseCategoryFixtures.CreateAsync(client, manager.AccessToken, ExpenseCategoryFixtures.UniqueName("Same"), "info");
        var id = created.GetProperty("id").GetGuid();
        var before = await ExpenseCategoryFixtures.ReadDetailAsync(client, manager.AccessToken, id);

        using var response = await ExpenseCategoryFixtures.PutAsync(client, manager.AccessToken, id, ExpenseCategoryFixtures.BodyFrom(before));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = System.Text.Json.JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.GetProperty("version").GetString().ShouldBe(before.GetProperty("version").GetString());
        var key = id.ToString("D");
        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.TargetId == key && row.Action != "expense-category.added", TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task ABadFormListsEveryFieldIncludingTheVersion()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await ExpenseCategoryFixtures.PutAsync(client, manager.AccessToken, RentId, new { name = " ", tone = "danger", version = "not-a-version" });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseCategoryFixtures.FieldErrors(problem, "name").ShouldBe(["Enter a category name."]);
        ExpenseCategoryFixtures.FieldErrors(problem, "tone").ShouldBe(["Choose a badge color."]);
        ExpenseCategoryFixtures.FieldErrors(problem, "version").ShouldHaveSingleItem();
    }

    [Fact]
    public async Task AnAdminCannotSaveAndAnUnknownCategoryIs404()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var form = ExpenseCategoryFixtures.BodyFrom(await ExpenseCategoryFixtures.ReadDetailAsync(client, manager.AccessToken, RentId));

        using var refused = await ExpenseCategoryFixtures.PutAsync(client, admin.AccessToken, RentId, form);
        using var unknown = await ExpenseCategoryFixtures.PutAsync(client, manager.AccessToken, Guid.NewGuid(), form);

        refused.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        unknown.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(unknown, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("expense-categories.not-found");
    }
}
