using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Expenses;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.ExpenseCategories;

/// <summary>D-08, D-09, D-11, D-13, D-15, CWE-862: staff read the seeded expense categories A to Z with Others last; a stranger is refused.</summary>
public sealed class ListExpenseCategoriesEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/expense-categories";

    private static readonly string[] Keys = ["expenseCount", "id", "isOthers", "name", "status", "tone"];

    private static readonly string[] Order =
    [
        "Equipment", "Government contributions", "Maintenance", "Rent", "Salaries", "Supplies", "Taxes and permits", "Transport and fuel", "Utilities", "Others",
    ];

    [Fact]
    public Task AManagerReadsTheTenCategories() => StaffReadsAsync(Roles.Manager);

    [Fact]
    public Task AnAdminReadsTheTenCategories() => StaffReadsAsync(Roles.Admin);

    [Fact]
    public async Task EachItemCountsTheExpensesThatUseItSoftDeletedOnesIncluded()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var equipment = ExpenseCategorySeed.Rows.Single(row => row.Name == "Equipment").Id;
        var day = new DateOnly(2026, 10, 20);
        var recorded = new DateTimeOffset(2026, 10, 20, 8, 0, 0, TimeSpan.Zero);
        await ExpenseFixtures.SeedAsync(database, new ExpenseSeed(day, manager.UserId, manager.UserId, recorded, equipment, "Sewing machine", 9500.00m));
        await ExpenseFixtures.SeedAsync(database, new ExpenseSeed(day, manager.UserId, manager.UserId, recorded, equipment, "Old iron", 800.00m, Deleted: true));

        var items = await ExpenseCategoryFixtures.ReadListAsync(client, manager.AccessToken);

        items.Single(item => item.GetProperty("name").GetString() == "Equipment").GetProperty("expenseCount").GetInt32().ShouldBe(2);
        items.Single(item => item.GetProperty("name").GetString() == "Rent").GetProperty("expenseCount").GetInt32().ShouldBe(0);
    }

    [Fact]
    public async Task AnAnonymousCallerGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get(Route);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    private async Task StaffReadsAsync(string role)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get(Route, (await TestSessions.StartAsync(factory, role)).AccessToken);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var items = document.RootElement.EnumerateArray().ToList();

        items.Select(item => item.GetProperty("name").GetString()).ShouldBe(Order);
        items.ShouldAllBe(item => item.GetProperty("status").GetString() == "active");
        items.ShouldAllBe(item => item.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal)
            .SequenceEqual(Keys));
        items.Where(item => item.GetProperty("isOthers").GetBoolean()).Select(item => item.GetProperty("name").GetString()).ShouldBe(["Others"]);
        items.Single(item => item.GetProperty("name").GetString() == "Rent").GetProperty("tone").GetString().ShouldBe("accent");
    }
}
