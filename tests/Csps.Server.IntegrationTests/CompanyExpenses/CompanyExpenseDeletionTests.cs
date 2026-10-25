using System.Globalization;
using System.Net;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.CompanyExpenses;

/// <summary>
/// CEXP-02, D-01, D-02, D-31, D-27, T-06-31, T-06-32, T-06-34: a Manager soft-deletes an expense and it stops counting everywhere,
/// the row and its history stay, one audit entry is written, and an Admin is refused.
/// </summary>
public sealed class CompanyExpenseDeletionTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AManagerDeletesAnExpenseAndItLeavesTheListItsTotalTheKpisAndTheDetail()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var label = $"Delete {Guid.NewGuid():N}";
        var body = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today);
        body["description"] = label;
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, body);
        var id = created.GetProperty("id").GetGuid();
        var listedBefore = await ExpenseFixtures.ReadPageAsync(client, manager.AccessToken, $"q={label}");
        var kpisBefore = await ExpenseFixtures.ReadKpisAsync(client, manager.AccessToken);
        listedBefore.Total.ShouldBe(1);
        listedBefore.PeriodTotal.ShouldBe(640.00m);

        using var response = await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var listedAfter = await ExpenseFixtures.ReadPageAsync(client, manager.AccessToken, $"q={label}");
        listedAfter.Total.ShouldBe(0);
        listedAfter.Items.ShouldBeEmpty();
        listedAfter.PeriodTotal.ShouldBe(0m);
        var kpisAfter = await ExpenseFixtures.ReadKpisAsync(client, manager.AccessToken);
        kpisAfter.ThisMonth.Total.ShouldBe(kpisBefore.ThisMonth.Total - 640.00m);
        kpisAfter.ThisMonth.Count.ShouldBe(kpisBefore.ThisMonth.Count - 1);
        using var read = await ExpenseFixtures.GetAsync(client, manager.AccessToken, id);
        read.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var edit = ExpenseFixtures.BodyFrom(created);
        edit["amount"] = 700m;
        using var put = await ExpenseFixtures.PutAsync(client, manager.AccessToken, id, edit);
        put.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task TheRowStaysWithTheDeleteMarkerAndTheManagerAsLastChangedBy()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var recorder = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, recorder.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, recorder.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        var before = TimeProvider.System.GetUtcNow();

        using var response = await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var after = TimeProvider.System.GetUtcNow();
        await using var context = database.CreateContext();
        var row = await context.CompanyExpenses.IgnoreQueryFilters(["SoftDelete"]).AsNoTracking()
            .SingleAsync(expense => expense.Id == id, TestContext.Current.CancellationToken);
        row.IsDeleted.ShouldBeTrue();
        row.DeletedById.ShouldBe(manager.UserId);
        row.DeletedAtUtc.ShouldNotBeNull().ShouldBeInRange(before.AddSeconds(-1), after.AddSeconds(1));
        row.UpdatedById.ShouldBe(manager.UserId);
        row.UpdatedAtUtc.ShouldNotBeNull().ShouldBeInRange(before.AddSeconds(-1), after.AddSeconds(1));
        row.CreatedById.ShouldBe(recorder.UserId);
        row.Description.ShouldBe("Thread and needles");
        row.Amount.ShouldBe(640.00m);
    }

    [Fact]
    public async Task TheDeleteWritesOneAuditEntryWithTheSnapshotAndNoDescriptionOrNotes()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var body = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today);
        body["description"] = "Zebra stripe fabric";
        body["notes"] = "Paid cash to Aling Nena";
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, body);
        var id = created.GetProperty("id").GetGuid();

        using var response = await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var key = id.ToString("D");
        await using var context = database.CreateContext();
        var entry = await context.AuditLog.AsNoTracking()
            .SingleAsync(row => row.TargetId == key && row.Action == "company-expense.deleted", TestContext.Current.CancellationToken);
        entry.TargetType.ShouldBe("CompanyExpense");
        entry.ActorUserId.ShouldBe(manager.UserId);
        entry.Detail.ShouldBe(
            $"date={today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)};category={ExpenseFixtures.SuppliesId:D};amount=640.00;payer={manager.UserId:D}");
        entry.Detail.ShouldNotBeNull().ShouldNotContain("Zebra", Case.Insensitive);
        entry.Detail.ShouldNotContain("Nena", Case.Insensitive);
    }

    [Fact]
    public async Task ASecondDeleteIs404AndWritesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        using (var first = await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using var second = await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id);

        second.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(second, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("company-expenses.not-found");
        var key = id.ToString("D");
        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.TargetId == key && row.Action == "company-expense.deleted", TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task AnUnknownIdIs404()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, Guid.NewGuid());

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task AnAdminIsRefusedEvenOnAnExpenseTheyRecordedAndNothingChanges()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, admin.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, admin.UserId, today));
        var id = created.GetProperty("id").GetGuid();

        using var response = await ExpenseFixtures.DeleteAsync(client, admin.AccessToken, id);
        using var anonymous = await ExpenseFixtures.DeleteAsync(client, null, id);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var stored = await ExpenseFixtures.ReadDetailAsync(client, admin.AccessToken, id);
        stored.GetProperty("id").GetGuid().ShouldBe(id);
        var key = id.ToString("D");
        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.TargetId == key && row.Action == "company-expense.deleted", TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task TwoDeletesSentTogetherGiveOneNoContentOneNotFoundAndOneAuditEntry()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var m1 = await TestSessions.StartAsync(factory, Roles.Manager);
        var m2 = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);

        for (var round = 1; round <= 5; round++)
        {
            var created = await ExpenseFixtures.CreateAsync(client, m1.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, m1.UserId, today));
            var id = created.GetProperty("id").GetGuid();

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => ExpenseFixtures.DeleteAsync(client, m1.AccessToken, id),
                () => ExpenseFixtures.DeleteAsync(client, m2.AccessToken, id));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
            statuses.Count(static status => status == HttpStatusCode.NoContent).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Count(static status => status == HttpStatusCode.NotFound).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            var key = id.ToString("D");
            await using var context = database.CreateContext();
            (await context.AuditLog.CountAsync(row => row.TargetId == key && row.Action == "company-expense.deleted", TestContext.Current.CancellationToken))
                .ShouldBe(1, $"round {round}");
        }
    }

    [Fact]
    public async Task AnEditFormSavedAfterASoftDeleteGets404()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        var openedForm = ExpenseFixtures.BodyFrom(created);
        using (var deleted = await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        openedForm["amount"] = 999m;
        using var late = await ExpenseFixtures.PutAsync(client, manager.AccessToken, id, openedForm);

        late.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
