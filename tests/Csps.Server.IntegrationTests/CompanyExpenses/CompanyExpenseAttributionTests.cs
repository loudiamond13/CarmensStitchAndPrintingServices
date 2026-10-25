using System.Net;
using Csps.Application.Security;
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
