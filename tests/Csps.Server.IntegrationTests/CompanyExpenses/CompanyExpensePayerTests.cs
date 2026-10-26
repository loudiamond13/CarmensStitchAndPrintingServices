using System.Net;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Expenses;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Users;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.CompanyExpenses;

/// <summary>CEXP-05, D-11, D-17, D-32, D-49, OQ-7: on an edit a changed payer or category is checked, and a saved one may stay.</summary>
public sealed class CompanyExpensePayerTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string PayerRefusal = "This person can't be chosen because their account isn't active. Choose someone else.";
    private const string CategoryRetired = "This category was retired. Choose another one.";

    [Theory]
    [InlineData("deactivated")]
    [InlineData("manager-locked")]
    [InlineData("deleted")]
    [InlineData("invited")]
    [InlineData("temporary-not-signed-in")]
    public async Task ChangingThePayerToSomeoneWhoCannotBeChosenIsRefusedOnThePayerField(string state)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var candidate = state == "temporary-not-signed-in"
            ? await CreateNeverSignedInAsync(client, manager.AccessToken)
            : await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Dee", "Dizon", Roles.Admin, withPassword: state != "invited");
        await PutInStateAsync(factory, candidate.Id, state);
        var body = ExpenseFixtures.BodyFrom(created);
        body["paidByUserId"] = candidate.Id;

        using var response = await ExpenseFixtures.PutAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.ErrorFields(problem).ShouldBe(["paidByUserId"]);
        ExpenseFixtures.FieldErrors(problem, "paidByUserId").ShouldBe([PayerRefusal]);
        var stored = await ExpenseFixtures.ReadDetailAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid());
        stored.GetProperty("paidBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
    }

    [Fact]
    public async Task KeepingASavedPayerWhoHasSinceBeenDeactivatedIsAccepted()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var payer = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Pia", "Perez", Roles.Admin);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, payer.Id, today));
        await AuthClient.DeactivateAsync(factory, payer.Id);
        var body = ExpenseFixtures.BodyFrom(created);
        body["amount"] = 77m;

        using var response = await ExpenseFixtures.PutAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var stored = await ExpenseFixtures.ReadDetailAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid());
        stored.GetProperty("paidBy").GetProperty("id").GetGuid().ShouldBe(payer.Id);
        stored.GetProperty("paidByActive").GetBoolean().ShouldBeFalse();
    }

    [Fact]
    public async Task ASavedPayerWhoHasNotSignedInShowsAsNotChoosableUntilTheirFirstCode()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var personClient = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var payer = await CreateNeverSignedInAsync(client, manager.AccessToken);
        var id = await ExpenseFixtures.SeedAsync(database, SeedPaidBy(payer.Id, manager.UserId, today));

        (await ExpenseFixtures.ReadDetailAsync(client, manager.AccessToken, id)).GetProperty("paidByActive").GetBoolean().ShouldBeFalse();

        using (var verified = await AuthClient.SignInThroughCodeAsync(personClient, new TestStaff(payer.Id, payer.Email, TemporaryPassword)))
        {
            verified.StatusCode.ShouldBe(HttpStatusCode.OK, await verified.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        (await ExpenseFixtures.ReadDetailAsync(client, manager.AccessToken, id)).GetProperty("paidByActive").GetBoolean().ShouldBeTrue();
    }

    [Fact]
    public async Task KeepingASavedPayerWhoHasNotSignedInIsAccepted()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var payer = await CreateNeverSignedInAsync(client, manager.AccessToken);
        var id = await ExpenseFixtures.SeedAsync(database, SeedPaidBy(payer.Id, manager.UserId, today));
        var body = ExpenseFixtures.BodyFrom(await ExpenseFixtures.ReadDetailAsync(client, manager.AccessToken, id));
        body["amount"] = 77m;

        using var response = await ExpenseFixtures.PutAsync(client, manager.AccessToken, id, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var stored = await ExpenseFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("paidBy").GetProperty("id").GetGuid().ShouldBe(payer.Id);
        stored.GetProperty("paidByActive").GetBoolean().ShouldBeFalse();
    }

    [Fact]
    public async Task TheDetailFlagAgreesWithThePayerStateForEveryKindOfPayer()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var tag = UserFixtures.NewTag();
        var active = await UserFixtures.CreateAsync(factory, tag, "Ana", "Active", Roles.Admin);
        var deactivated = await UserFixtures.CreateAsync(factory, tag, "Dee", "Dizon", Roles.Admin);
        var locked = await UserFixtures.CreateAsync(factory, tag, "Gina", "Garcia");
        var deleted = await UserFixtures.CreateAsync(factory, tag, "Jun", "Javier", Roles.Admin);
        var invited = await UserFixtures.CreateAsync(factory, tag, "Hal", "Honrado", Roles.Admin, withPassword: false);
        var unmarked = await AuthClient.CreateStaffAsync(factory, StaffState.Unconfirmed, Roles.Admin);
        var neverSignedIn = await CreateNeverSignedInAsync(client, manager.AccessToken);
        var reset = await UserFixtures.CreateAsync(factory, tag, "Rey", "Reset", Roles.Admin);
        await AuthClient.DeactivateAsync(factory, deactivated.Id);
        await AccountStateFixtures.ManagerLockAsync(factory, locked.Id);
        await AccountStateFixtures.MarkDeletedAsync(factory, deleted.Id);
        await UserFixtures.SetTemporaryPasswordAsync(client, manager.AccessToken, reset.Id, $"Tmp-{Guid.NewGuid():N}!x");
        Guid[] payers = [active.Id, deactivated.Id, locked.Id, deleted.Id, invited.Id, unmarked.Id, neverSignedIn.Id, reset.Id];

        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var directory = scope.ServiceProvider.GetRequiredService<IStaffDirectory>();
            foreach (var payer in payers)
            {
                var id = await ExpenseFixtures.SeedAsync(database, SeedPaidBy(payer, manager.UserId, today));
                var detail = await ExpenseFixtures.ReadDetailAsync(client, manager.AccessToken, id);
                var state = (await directory.GetStaffStateAsync(payer, TestContext.Current.CancellationToken)).ShouldNotBeNull();
                detail.GetProperty("paidByActive").GetBoolean().ShouldBe(state.CanPay, $"paidByActive and CanPay disagree for {state.Name}");
            }
        }
    }

    [Fact]
    public async Task ThePayerMayBeTheSameAsTheRecorder()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var other = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, other.UserId, today));
        var body = ExpenseFixtures.BodyFrom(created);
        body["paidByUserId"] = manager.UserId;

        using var response = await ExpenseFixtures.PutAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var stored = await ExpenseFixtures.ReadDetailAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid());
        stored.GetProperty("paidBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        stored.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
    }

    [Fact]
    public async Task ChangingToARetiredCategoryIsRefusedOnTheCategoryField()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var retired = await AddCategoryAsync(retire: true);
        var body = ExpenseFixtures.BodyFrom(created);
        body["categoryId"] = retired;

        using var response = await ExpenseFixtures.PutAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.ErrorFields(problem).ShouldBe(["categoryId"]);
        ExpenseFixtures.FieldErrors(problem, "categoryId").ShouldBe([CategoryRetired]);
    }

    [Fact]
    public async Task ChangingToAnUnknownCategoryIsRefusedWithTheChooseMessage()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var body = ExpenseFixtures.BodyFrom(created);
        body["categoryId"] = Guid.NewGuid();

        using var response = await ExpenseFixtures.PutAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.FieldErrors(problem, "categoryId").ShouldBe([ExpenseRules.CategoryRequired]);
    }

    [Fact]
    public async Task KeepingTheSavedCategoryAfterItWasRetiredIsAccepted()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var category = await AddCategoryAsync(retire: false);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(category, manager.UserId, today));
        await RetireAsync(category);
        var body = ExpenseFixtures.BodyFrom(created);
        body["description"] = "Same category, new words";

        using var response = await ExpenseFixtures.PutAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var stored = await ExpenseFixtures.ReadDetailAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid());
        stored.GetProperty("category").GetProperty("id").GetGuid().ShouldBe(category);
        stored.GetProperty("category").GetProperty("retired").GetBoolean().ShouldBeTrue();
    }

    [Fact]
    public async Task ARealEditWritesAChangedRowAndASeparatePayerChangedRowWithTheDocumentedDetails()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var newPayer = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        var body = ExpenseFixtures.BodyFrom(created);
        body["amount"] = 999.5m;
        body["description"] = "Zebra stripe fabric";
        body["notes"] = "Paid cash to Aling Nena";
        body["paidByUserId"] = newPayer.UserId;

        using var response = await ExpenseFixtures.PutAsync(client, manager.AccessToken, id, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var key = id.ToString("D");
        await using var context = database.CreateContext();
        var rows = await context.AuditLog.AsNoTracking()
            .Where(row => row.TargetId == key && row.Action != "company-expense.added")
            .OrderBy(row => row.Action)
            .ToListAsync(TestContext.Current.CancellationToken);
        rows.Select(row => row.Action).ShouldBe(["company-expense.changed", "company-expense.payer-changed"]);
        rows.ShouldAllBe(row => row.TargetType == "CompanyExpense" && row.ActorUserId == manager.UserId);
        rows[0].Detail.ShouldBe($"amount=640.00>999.50;fields=description,notes;payer={newPayer.UserId:D}");
        rows[1].Detail.ShouldBe($"payer={manager.UserId:D}>{newPayer.UserId:D}");
        rows.ShouldAllBe(row => !row.Detail!.Contains("Zebra", StringComparison.OrdinalIgnoreCase) && !row.Detail.Contains("Nena", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task SavingTheSamePayerAgainAddsNoPayerChangedRowAndAnUnchangedFormAddsNoRowAtAll()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        var edit = ExpenseFixtures.BodyFrom(created);
        edit["amount"] = 700m;
        using var first = await ExpenseFixtures.PutAsync(client, manager.AccessToken, id, edit);
        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        var saved = await ExpenseFixtures.ReadDetailAsync(client, manager.AccessToken, id);

        using var identical = await ExpenseFixtures.PutAsync(client, manager.AccessToken, id, ExpenseFixtures.BodyFrom(saved));

        identical.StatusCode.ShouldBe(HttpStatusCode.OK);
        var key = id.ToString("D");
        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.TargetId == key && row.Action == "company-expense.payer-changed", TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.AuditLog.CountAsync(row => row.TargetId == key && row.Action == "company-expense.changed", TestContext.Current.CancellationToken)).ShouldBe(1);
        var after = await ExpenseFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        after.GetProperty("version").GetString().ShouldBe(saved.GetProperty("version").GetString());
    }

    [Fact]
    public async Task APayerOnlyEditWritesOnlyAPayerChangedRow()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var newPayer = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        var body = ExpenseFixtures.BodyFrom(created);
        body["paidByUserId"] = newPayer.UserId;

        using var response = await ExpenseFixtures.PutAsync(client, manager.AccessToken, id, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var key = id.ToString("D");
        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.TargetId == key && row.Action == "company-expense.changed", TestContext.Current.CancellationToken)).ShouldBe(0);
        var payerRow = await context.AuditLog.AsNoTracking()
            .SingleAsync(row => row.TargetId == key && row.Action == "company-expense.payer-changed", TestContext.Current.CancellationToken);
        payerRow.Detail.ShouldBe($"payer={manager.UserId:D}>{newPayer.UserId:D}");
    }

    private static readonly string TemporaryPassword = $"Tmp-{Guid.NewGuid():N}!x";

    private static ExpenseSeed SeedPaidBy(Guid payerId, Guid recorderId, DateOnly date) =>
        new(date, payerId, recorderId, TimeProvider.System.GetUtcNow().AddMinutes(-5), ExpenseFixtures.SuppliesId, "Seeded expense", 640m);

    private static async Task<SeededUser> CreateNeverSignedInAsync(HttpClient client, string managerToken)
    {
        var email = $"tia.{Guid.NewGuid():N}@example.com";
        var id = await UserFixtures.CreateWithTemporaryPasswordAsync(client, managerToken, email, TemporaryPassword);
        return new SeededUser(id, "Tia", "Temporal", email, Roles.Admin);
    }

    private static async Task PutInStateAsync(CspsApiFactory factory, Guid id, string state)
    {
        switch (state)
        {
            case "deactivated":
                await AuthClient.DeactivateAsync(factory, id);
                break;
            case "manager-locked":
                await AccountStateFixtures.ManagerLockAsync(factory, id);
                break;
            case "deleted":
                await AccountStateFixtures.MarkDeletedAsync(factory, id);
                break;
            default:
                break;
        }
    }

    private async Task<Guid> AddCategoryAsync(bool retire)
    {
        await using var context = database.CreateContext();
        var row = new ExpenseCategorySeedRow(Guid.NewGuid(), $"Cat {Guid.NewGuid():N}"[..20], "neutral");
        context.ExpenseCategories.Add(ExpenseCategory.FromSeed(row));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        if (retire)
        {
            await RetireAsync(row.Id);
        }

        return row.Id;
    }

    private async Task RetireAsync(Guid categoryId)
    {
        await using var context = database.CreateContext();
        await context.ExpenseCategories.Where(category => category.Id == categoryId)
            .ExecuteUpdateAsync(set => set.SetProperty(category => category.RetiredAtUtc, TimeProvider.System.GetUtcNow()), TestContext.Current.CancellationToken);
    }
}
