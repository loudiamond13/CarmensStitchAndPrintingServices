using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.CompanyExpenses;

/// <summary>SEC-08, CEXP-04, CEXP-05, T-06-06, CWE-915: who recorded an expense and when come from the token and the clock, never from the request.</summary>
public sealed class CompanyExpenseAttributionTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task ForgedAttributionAndDeletionMembersInTheBodyAreIgnored()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var caller = await TestSessions.StartAsync(factory, Roles.Admin);
        var other = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var body = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, caller.UserId, today);
        body["createdById"] = other.UserId;
        body["createdAt"] = "1999-01-01T00:00:00Z";
        body["createdAtUtc"] = "1999-01-01T00:00:00Z";
        body["updatedById"] = other.UserId;
        body["updatedAt"] = "1999-01-01T00:00:00Z";
        body["updatedAtUtc"] = "1999-01-01T00:00:00Z";
        body["deletedAtUtc"] = "1999-01-01T00:00:00Z";
        body["deletedById"] = other.UserId;
        body["rowVersion"] = "AAAAAAAAAAE=";
        body["version"] = "AAAAAAAAAAE=";
        var before = TimeProvider.System.GetUtcNow();

        var created = await ExpenseFixtures.CreateAsync(client, caller.AccessToken, body);

        var after = TimeProvider.System.GetUtcNow();
        await using var context = database.CreateContext();
        var row = await context.CompanyExpenses.IgnoreQueryFilters(["SoftDelete"]).AsNoTracking()
            .SingleAsync(expense => expense.Id == created.GetProperty("id").GetGuid(), TestContext.Current.CancellationToken);
        row.CreatedById.ShouldBe(caller.UserId);
        row.CreatedAtUtc.ShouldBeInRange(before.AddSeconds(-1), after.AddSeconds(1));
        row.UpdatedById.ShouldBeNull();
        row.UpdatedAtUtc.ShouldBeNull();
        row.DeletedAtUtc.ShouldBeNull();
        row.DeletedById.ShouldBeNull();
        row.IsDeleted.ShouldBeFalse();
        row.RowVersion.Length.ShouldBe(8);
        created.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(caller.UserId);
        created.GetProperty("recordedAt").GetDateTimeOffset().ShouldBeInRange(before.AddSeconds(-1), after.AddSeconds(1));
        ExpenseFixtures.IsNull(created, "lastChangedBy").ShouldBeTrue();
        ExpenseFixtures.IsNull(created, "lastChangedAt").ShouldBeTrue();
    }

    [Fact]
    public async Task AnExpenseRecordedByAnAdminAndPaidByAManagerReadsPaidByTheManagerAndRecordedByTheAdmin()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var recorder = await TestSessions.StartAsync(factory, Roles.Admin);
        var payer = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);

        var created = await ExpenseFixtures.CreateAsync(client, recorder.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, payer.UserId, today));
        var asPayer = await ExpenseFixtures.ReadDetailAsync(client, payer.AccessToken, created.GetProperty("id").GetGuid());

        created.GetProperty("paidBy").GetProperty("id").GetGuid().ShouldBe(payer.UserId);
        created.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(recorder.UserId);
        created.GetProperty("canEdit").GetBoolean().ShouldBeTrue();
        asPayer.GetProperty("paidBy").GetProperty("id").GetGuid().ShouldBe(payer.UserId);
        asPayer.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(recorder.UserId);
        asPayer.GetProperty("canEdit").GetBoolean().ShouldBeTrue();
    }

    [Fact]
    public async Task AnAdminWhoNeitherRecordedNorPaidCannotEditTheExpense()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var recorder = await TestSessions.StartAsync(factory, Roles.Manager);
        var stranger = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, recorder.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, recorder.UserId, today));

        var asStranger = await ExpenseFixtures.ReadDetailAsync(client, stranger.AccessToken, created.GetProperty("id").GetGuid());

        asStranger.GetProperty("canEdit").GetBoolean().ShouldBeFalse();
    }

    [Fact]
    public async Task ARowWithNoCreatorReadsRecordedByNull()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var caller = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, caller.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, caller.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        await using (var context = database.CreateContext())
        {
            var changed = await context.CompanyExpenses.Where(expense => expense.Id == id)
                .ExecuteUpdateAsync(set => set.SetProperty(expense => expense.CreatedById, (Guid?)null), TestContext.Current.CancellationToken);
            changed.ShouldBe(1);
        }

        var read = await ExpenseFixtures.ReadDetailAsync(client, caller.AccessToken, id);

        ExpenseFixtures.IsNull(read, "recordedBy").ShouldBeTrue();
        read.GetProperty("canEdit").GetBoolean().ShouldBeTrue("the caller is the payer");
    }

    [Fact]
    public async Task AnEditByAnotherUserKeepsTheRecorderAndStampsTheEditorAndTheServerClock()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var recorder = await TestSessions.StartAsync(factory, Roles.Admin);
        var editor = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, recorder.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, recorder.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        var body = ExpenseFixtures.BodyFrom(created);
        body["amount"] = 811m;
        var before = TimeProvider.System.GetUtcNow();

        using var response = await ExpenseFixtures.PutAsync(client, editor.AccessToken, id, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var after = TimeProvider.System.GetUtcNow();
        var read = await ExpenseFixtures.ReadDetailAsync(client, editor.AccessToken, id);
        read.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(recorder.UserId);
        read.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(editor.UserId);
        var changedAt = read.GetProperty("lastChangedAt").GetDateTimeOffset();
        changedAt.ShouldBeInRange(before.AddSeconds(-1), after.AddSeconds(1));
        changedAt.ShouldBeGreaterThanOrEqualTo(read.GetProperty("recordedAt").GetDateTimeOffset());
        read.EnumerateObject().Select(property => property.Name).ToList().IndexOf("recordedBy")
            .ShouldBeLessThan(read.EnumerateObject().Select(property => property.Name).ToList().IndexOf("lastChangedBy"));
    }

    [Fact]
    public async Task ForgedAttributionMembersInAnEditBodyAreIgnored()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var recorder = await TestSessions.StartAsync(factory, Roles.Admin);
        var editor = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, recorder.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, recorder.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        var body = ExpenseFixtures.BodyFrom(created);
        body["amount"] = 812m;
        body["createdById"] = editor.UserId;
        body["createdAt"] = "1999-01-01T00:00:00Z";
        body["createdAtUtc"] = "1999-01-01T00:00:00Z";
        body["updatedById"] = recorder.UserId;
        body["updatedAt"] = "1999-01-01T00:00:00Z";
        body["updatedAtUtc"] = "1999-01-01T00:00:00Z";
        body["deletedAtUtc"] = "1999-01-01T00:00:00Z";
        body["deletedById"] = editor.UserId;
        body["rowVersion"] = "AAAAAAAAAAE=";
        var before = TimeProvider.System.GetUtcNow();

        using var response = await ExpenseFixtures.PutAsync(client, editor.AccessToken, id, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var row = await context.CompanyExpenses.IgnoreQueryFilters(["SoftDelete"]).AsNoTracking()
            .SingleAsync(expense => expense.Id == id, TestContext.Current.CancellationToken);
        row.CreatedById.ShouldBe(recorder.UserId);
        row.CreatedAtUtc.ShouldBe(created.GetProperty("recordedAt").GetDateTimeOffset());
        row.UpdatedById.ShouldBe(editor.UserId);
        row.UpdatedAtUtc.ShouldNotBeNull().ShouldBeInRange(before.AddSeconds(-1), TimeProvider.System.GetUtcNow().AddSeconds(1));
        row.DeletedAtUtc.ShouldBeNull();
        row.DeletedById.ShouldBeNull();
        row.Amount.ShouldBe(812m);
    }

    [Fact]
    public async Task BothNamesStayWithFormerStaffTrueAfterBothUsersAreDeleted()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var recorder = await TestSessions.StartAsync(factory, Roles.Admin);
        var editor = await TestSessions.StartAsync(factory, Roles.Manager);
        var viewer = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, recorder.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, viewer.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        var body = ExpenseFixtures.BodyFrom(created);
        body["amount"] = 813m;
        using (var edited = await ExpenseFixtures.PutAsync(client, editor.AccessToken, id, body))
        {
            edited.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        await AccountStateFixtures.MarkDeletedAsync(factory, recorder.UserId);
        await AccountStateFixtures.MarkDeletedAsync(factory, editor.UserId);
        var read = await ExpenseFixtures.ReadDetailAsync(client, viewer.AccessToken, id);

        var recordedBy = read.GetProperty("recordedBy");
        recordedBy.GetProperty("id").GetGuid().ShouldBe(recorder.UserId);
        recordedBy.GetProperty("name").GetString().ShouldBe("Paolo Reyes");
        recordedBy.GetProperty("formerStaff").GetBoolean().ShouldBeTrue();
        var changedBy = read.GetProperty("lastChangedBy");
        changedBy.GetProperty("id").GetGuid().ShouldBe(editor.UserId);
        changedBy.GetProperty("name").GetString().ShouldBe("Paolo Reyes");
        changedBy.GetProperty("formerStaff").GetBoolean().ShouldBeTrue();
    }

    [Fact]
    public async Task ACreatorEditingTheirOwnExpenseIsBothRecordedByAndLastChangedBy()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var creator = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, creator.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, creator.UserId, today));
        var body = ExpenseFixtures.BodyFrom(created);
        body["amount"] = 814m;

        using var response = await ExpenseFixtures.PutAsync(client, creator.AccessToken, created.GetProperty("id").GetGuid(), body);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        document.RootElement.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(creator.UserId);
        document.RootElement.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(creator.UserId);
    }

    [Fact]
    public async Task ARenamedEditorShowsTheNewNameBecauseNamesAreReadAtReadTime()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var editor = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, editor.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, editor.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        var body = ExpenseFixtures.BodyFrom(created);
        body["amount"] = 815m;
        using (var edited = await ExpenseFixtures.PutAsync(client, editor.AccessToken, id, body))
        {
            edited.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        await using (var context = database.CreateContext())
        {
            await context.Users.Where(user => user.Id == editor.UserId)
                .ExecuteUpdateAsync(set => set.SetProperty(user => user.FirstName, "Renamed"), TestContext.Current.CancellationToken);
        }

        var read = await ExpenseFixtures.ReadDetailAsync(client, editor.AccessToken, id);

        read.GetProperty("lastChangedBy").GetProperty("name").GetString().ShouldBe("Renamed Reyes");
        read.GetProperty("recordedBy").GetProperty("name").GetString().ShouldBe("Renamed Reyes");
    }

    [Fact]
    public async Task ASoftDeletedExpenseAnswers404WithTheDeletedMessage()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var caller = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, caller.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, caller.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        await using (var context = database.CreateContext())
        {
            await context.CompanyExpenses.Where(expense => expense.Id == id)
                .ExecuteUpdateAsync(set => set.SetProperty(expense => expense.DeletedAtUtc, TimeProvider.System.GetUtcNow()), TestContext.Current.CancellationToken);
        }

        using var response = await ExpenseFixtures.GetAsync(client, caller.AccessToken, id);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("company-expenses.not-found");
        problem.GetProperty("detail").GetString().ShouldBe("This expense was deleted.");
    }
}
