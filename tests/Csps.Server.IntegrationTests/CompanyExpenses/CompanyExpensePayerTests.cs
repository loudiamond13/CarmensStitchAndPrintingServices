using System.Net;
using Csps.Application.Security;
using Csps.Domain.Expenses;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Users;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.CompanyExpenses;

/// <summary>CEXP-05, D-11, D-17, D-32, OQ-7: on an edit a changed payer or category is checked, and a saved one may stay.</summary>
public sealed class CompanyExpensePayerTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string PayerRefusal = "This person can't be chosen because their account isn't active. Choose someone else.";
    private const string CategoryRetired = "This category was retired. Choose another one.";

    [Theory]
    [InlineData("deactivated")]
    [InlineData("manager-locked")]
    [InlineData("deleted")]
    [InlineData("invited")]
    public async Task ChangingThePayerToSomeoneWhoCannotBeChosenIsRefusedOnThePayerField(string state)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var candidate = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Dee", "Dizon", Roles.Admin, withPassword: state != "invited");
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
