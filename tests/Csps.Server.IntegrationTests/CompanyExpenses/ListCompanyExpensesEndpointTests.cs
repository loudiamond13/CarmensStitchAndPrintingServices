using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.CompanyExpenses;

/// <summary>CEXP-01, D-23, D-25, D-01, PERF-04: staff list the expenses of a window, newest first, with a total over every page.</summary>
public sealed class ListCompanyExpensesEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    // 12:00 in Manila on 2026-10-25, so the business today is 2026-10-25 whatever the machine's own day is.
    private static readonly DateTimeOffset FixedNow = new(2026, 10, 25, 4, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 25);

    [Theory]
    [InlineData(Roles.Admin)]
    [InlineData(Roles.Manager)]
    public async Task BothRolesGetTheDefaultWindowThirtyDaysEachSideOfTheBusinessToday(string role)
    {
        await using var rig = await Rig.StartAsync(database);
        var paidBy = rig.Admin.UserId;
        var recorded = FixedNow.AddHours(-8);
        foreach (var date in new[] { new DateOnly(2026, 9, 24), new DateOnly(2026, 9, 25), new DateOnly(2026, 10, 25), new DateOnly(2026, 11, 24), new DateOnly(2026, 11, 25) })
        {
            await ExpenseFixtures.SeedAsync(database, new ExpenseSeed(date, paidBy, rig.Manager.UserId, recorded, ExpenseFixtures.SuppliesId, $"Row {date:MM-dd}", 100.00m));
        }

        var page = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.TokenOf(role));

        page.From.ShouldBe(new DateOnly(2026, 9, 25));
        page.To.ShouldBe(new DateOnly(2026, 11, 24));
        page.Today.ShouldBe(Today);
        page.Items.Select(item => item.Date).ShouldBe([new DateOnly(2026, 11, 24), new DateOnly(2026, 10, 25), new DateOnly(2026, 9, 25)]);
        page.Total.ShouldBe(3);
        page.PeriodTotal.ShouldBe(300.00m);
        page.Page.ShouldBe(1);
        page.PageSize.ShouldBe(20);
    }

    [Fact]
    public async Task ItemsAreNewestFirstByDateThenByWhenTheyWereRecorded()
    {
        await using var rig = await Rig.StartAsync(database);
        var paidBy = rig.Admin.UserId;
        var older = await ExpenseFixtures.SeedAsync(database, new ExpenseSeed(Today, paidBy, rig.Manager.UserId, FixedNow.AddHours(-6), ExpenseFixtures.SuppliesId, "Older entry", 10.00m));
        var newer = await ExpenseFixtures.SeedAsync(database, new ExpenseSeed(Today, paidBy, rig.Manager.UserId, FixedNow.AddHours(-2), ExpenseFixtures.SuppliesId, "Newer entry", 20.00m));
        var earlierDay = await ExpenseFixtures.SeedAsync(database, new ExpenseSeed(Today.AddDays(-3), paidBy, rig.Manager.UserId, FixedNow.AddHours(-1), ExpenseFixtures.SuppliesId, "Earlier day", 30.00m));
        var laterDay = await ExpenseFixtures.SeedAsync(database, new ExpenseSeed(Today.AddDays(2), paidBy, rig.Manager.UserId, FixedNow.AddHours(-9), ExpenseFixtures.SuppliesId, "Later day", 40.00m));

        var page = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken);

        page.Items.Select(item => item.Id).ShouldBe([laterDay, newer, older, earlierDay]);
    }

    [Fact]
    public async Task TotalAndPeriodTotalCoverEveryPageNotJustTheRowsShown()
    {
        await using var rig = await Rig.StartAsync(database);
        var amounts = new[] { 10.10m, 20.20m, 30.30m, 40.40m, 50.50m };
        for (var index = 0; index < amounts.Length; index++)
        {
            await ExpenseFixtures.SeedAsync(
                database,
                new ExpenseSeed(Today.AddDays(-index), rig.Admin.UserId, rig.Manager.UserId, FixedNow.AddHours(-index - 1), ExpenseFixtures.SuppliesId, $"Row {index}", amounts[index]));
        }

        var first = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Manager.AccessToken, "pageSize=2&page=1");
        var second = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Manager.AccessToken, "pageSize=2&page=2");

        first.Items.Count.ShouldBe(2);
        second.Items.Count.ShouldBe(2);
        first.Total.ShouldBe(5);
        second.Total.ShouldBe(5);
        first.PeriodTotal.ShouldBe(151.50m);
        second.PeriodTotal.ShouldBe(151.50m);
        first.Items.Select(item => item.Id).Intersect(second.Items.Select(item => item.Id)).ShouldBeEmpty();
    }

    [Fact]
    public async Task ASoftDeletedExpenseIsNotInTheItemsTheTotalOrThePeriodTotal()
    {
        await using var rig = await Rig.StartAsync(database);
        var kept = await ExpenseFixtures.SeedAsync(database, new ExpenseSeed(Today, rig.Admin.UserId, rig.Manager.UserId, FixedNow.AddHours(-3), ExpenseFixtures.SuppliesId, "Kept", 75.25m));
        await ExpenseFixtures.SeedAsync(database, new ExpenseSeed(Today, rig.Admin.UserId, rig.Manager.UserId, FixedNow.AddHours(-2), ExpenseFixtures.SuppliesId, "Gone", 900.00m, Deleted: true));

        var page = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken);

        page.Items.Select(item => item.Id).ShouldBe([kept]);
        page.Total.ShouldBe(1);
        page.PeriodTotal.ShouldBe(75.25m);
    }

    [Fact]
    public async Task NoNotesMemberAppearsInAnyItem()
    {
        await using var rig = await Rig.StartAsync(database);
        await ExpenseFixtures.SeedAsync(database, new ExpenseSeed(Today, rig.Admin.UserId, rig.Manager.UserId, FixedNow.AddHours(-3), ExpenseFixtures.SuppliesId, "With notes", 12.00m, "private-note-text"));

        using var response = await ExpenseFixtures.ListAsync(rig.Client, rig.Manager.AccessToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var item = document.RootElement.GetProperty("items")[0];
        item.TryGetProperty("notes", out _).ShouldBeFalse();
        text.ShouldNotContain("private-note-text");
    }

    [Fact]
    public async Task AnAnonymousListGets401()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = baseFactory.CreateClient();

        using var response = await ExpenseFixtures.ListAsync(client, accessToken: null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    // A host whose business day is fixed at 2026-10-25, with one Admin and one Manager already signed in. The sessions are made on
    // the base host so their tokens carry the real time, which the token check compares with the system clock.
    private sealed class Rig : IAsyncDisposable
    {
        private readonly CspsApiFactory _baseFactory;
        private readonly WebApplicationFactory<Program> _factory;

        private Rig(CspsApiFactory baseFactory, WebApplicationFactory<Program> factory, StartedSession admin, StartedSession manager)
        {
            _baseFactory = baseFactory;
            _factory = factory;
            Client = factory.CreateClient();
            Admin = admin;
            Manager = manager;
        }

        public HttpClient Client { get; }

        public StartedSession Admin { get; }

        public StartedSession Manager { get; }

        public static async Task<Rig> StartAsync(CspsDatabase database)
        {
            await database.ResetAsync();
            var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
            var admin = await TestSessions.StartAsync(baseFactory, Roles.Admin);
            var manager = await TestSessions.StartAsync(baseFactory, Roles.Manager);
            return new Rig(baseFactory, AuthClient.WithClock(baseFactory, new FakeTimeProvider(FixedNow)), admin, manager);
        }

        public string TokenOf(string role) => role == Roles.Admin ? Admin.AccessToken : Manager.AccessToken;

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await _factory.DisposeAsync();
            await _baseFactory.DisposeAsync();
        }
    }
}
