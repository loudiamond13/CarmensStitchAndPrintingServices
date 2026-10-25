using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Expenses;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Users;
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

    private static readonly Guid RentId = ExpenseCategorySeed.Rows.Single(row => row.Name == "Rent").Id;

    [Fact]
    public async Task TheCategoryFilterReturnsOnlyThatCategory()
    {
        await using var rig = await Rig.StartAsync(database);
        var rent = await rig.SeedAsync(database, "Monthly rent", categoryId: RentId);
        await rig.SeedAsync(database, "Thread", categoryId: ExpenseFixtures.SuppliesId);

        var page = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken, $"category={RentId:D}");

        page.Items.Select(item => item.Id).ShouldBe([rent]);
        page.Total.ShouldBe(1);
        page.Items[0].Category.Name.ShouldBe("Rent");
    }

    [Fact]
    public async Task ACustomRangeListsOnlyItsDaysAndReturnsItsOwnDates()
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.SeedAsync(database, "Before", date: new DateOnly(2026, 8, 31));
        var first = await rig.SeedAsync(database, "First day", date: new DateOnly(2026, 9, 1));
        var last = await rig.SeedAsync(database, "Last day", date: new DateOnly(2026, 9, 30));
        await rig.SeedAsync(database, "After", date: new DateOnly(2026, 10, 1));

        var page = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Manager.AccessToken, "from=2026-09-01&to=2026-09-30");

        page.Items.Select(item => item.Id).ShouldBe([last, first]);
        (page.From, page.To, page.Today).ShouldBe((new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 30), Today));
    }

    [Fact]
    public async Task AFromEqualToTheEndListsThatOneDay()
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.SeedAsync(database, "Day before", date: new DateOnly(2026, 9, 14));
        var only = await rig.SeedAsync(database, "The day", date: new DateOnly(2026, 9, 15));
        await rig.SeedAsync(database, "Day after", date: new DateOnly(2026, 9, 16));

        var page = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken, "from=2026-09-15&to=2026-09-15");

        page.Items.Select(item => item.Id).ShouldBe([only]);
    }

    [Fact]
    public async Task TheSearchFindsTheDescriptionWhateverTheCase()
    {
        await using var rig = await Rig.StartAsync(database);
        var thread = await rig.SeedAsync(database, "Thread and Needles");
        await rig.SeedAsync(database, "Electricity");

        var upper = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken, "q=THREAD");
        var lower = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken, "q=and%20needles");

        upper.Items.Select(item => item.Id).ShouldBe([thread]);
        lower.Items.Select(item => item.Id).ShouldBe([thread]);
    }

    [Fact]
    public async Task TheSearchFindsThePayerAndTheRecorderByFirstNameLastNameOrBoth()
    {
        await using var rig = await Rig.StartAsync(database);
        var tag = UserFixtures.NewTag();
        var payer = await UserFixtures.CreateAsync(rig.Host, tag, "Marites", "Santos");
        var recorder = await UserFixtures.CreateAsync(rig.Host, tag, "Jonel", "Bautista");
        var row = await rig.SeedAsync(database, "Ribbon", paidBy: payer.Id, recordedBy: recorder.Id);
        await rig.SeedAsync(database, "Unrelated");

        foreach (var q in new[] { payer.FirstName, payer.LastName, $"{payer.FirstName} {payer.LastName}", recorder.FirstName, recorder.LastName, $"{recorder.FirstName} {recorder.LastName}", payer.FirstName.ToUpperInvariant() })
        {
            var page = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken, $"q={Uri.EscapeDataString(q)}");

            page.Items.Select(item => item.Id).ShouldBe([row], $"q={q}");
            page.Total.ShouldBe(1);
        }
    }

    [Fact]
    public async Task APayerWhoIsAlsoTheRecorderIsFoundOnceByName()
    {
        await using var rig = await Rig.StartAsync(database);
        var tag = UserFixtures.NewTag();
        var person = await UserFixtures.CreateAsync(rig.Host, tag, "Lorna", "Dizon");
        var row = await rig.SeedAsync(database, "Ink", paidBy: person.Id, recordedBy: person.Id, amount: 55.00m);

        var page = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Manager.AccessToken, $"q={Uri.EscapeDataString(person.FirstName)}");

        page.Items.Select(item => item.Id).ShouldBe([row]);
        (page.Total, page.PeriodTotal).ShouldBe((1, 55.00m));
    }

    [Fact]
    public async Task APercentSignAndAnUnderscoreInTheSearchAreTakenLiterally()
    {
        await using var rig = await Rig.StartAsync(database);
        var percent = await rig.SeedAsync(database, "Discount 50% off");
        var underscore = await rig.SeedAsync(database, "snake_case");
        await rig.SeedAsync(database, "snakeXcase");
        await rig.SeedAsync(database, "Plain");

        var percentPage = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken, "q=%25");
        var underscorePage = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken, "q=_");
        var bracketPage = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken, "q=%5B");

        percentPage.Items.Select(item => item.Id).ShouldBe([percent]);
        underscorePage.Items.Select(item => item.Id).ShouldBe([underscore]);
        bracketPage.Items.ShouldBeEmpty();
    }

    [Fact]
    public async Task TheSearchNeverMatchesTheNotes()
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.SeedAsync(database, "Ordinary", notes: "zebrastripe");

        var page = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken, "q=zebrastripe");

        page.Items.ShouldBeEmpty();
        page.Total.ShouldBe(0);
        page.PeriodTotal.ShouldBe(0m);
    }

    [Fact]
    public async Task AnEmptyOrBlankSearchAppliesNoSearch()
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.SeedAsync(database, "One");
        await rig.SeedAsync(database, "Two");

        var empty = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken, "q=");
        var blank = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken, "q=%20%20");

        empty.Total.ShouldBe(2);
        blank.Total.ShouldBe(2);
    }

    [Fact]
    public async Task NothingMatchingGivesNoItemsAndZeroTotals()
    {
        await using var rig = await Rig.StartAsync(database);

        var page = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken);

        page.Items.ShouldBeEmpty();
        (page.Total, page.PeriodTotal).ShouldBe((0, 0m));
    }

    [Fact]
    public async Task PagingGivesTheNextRowsThenTheRemainderThenNothingWithTheTrueTotal()
    {
        await using var rig = await Rig.StartAsync(database);
        var ids = new List<Guid>();
        for (var index = 0; index < 5; index++)
        {
            ids.Add(await rig.SeedAsync(database, $"Row {index}", date: Today.AddDays(-index), amount: 10.00m));
        }

        var second = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken, "pageSize=2&page=2");
        var third = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken, "pageSize=2&page=3");
        var past = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken, "pageSize=2&page=9");

        second.Items.Select(item => item.Id).ShouldBe([ids[2], ids[3]]);
        third.Items.Select(item => item.Id).ShouldBe([ids[4]]);
        past.Items.ShouldBeEmpty();
        (past.Total, past.PeriodTotal, past.Page, past.PageSize).ShouldBe((5, 50.00m, 9, 2));
    }

    [Fact]
    public async Task RowsOnTheSameDayAndTimeStillPageWithoutRepeatsOrGaps()
    {
        await using var rig = await Rig.StartAsync(database);
        var ids = new HashSet<Guid>();
        for (var index = 0; index < 5; index++)
        {
            ids.Add(await rig.SeedAsync(database, $"Same {index}"));
        }

        var seen = new List<Guid>();
        foreach (var number in new[] { 1, 2, 3 })
        {
            var page = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken, $"pageSize=2&page={number}");
            seen.AddRange(page.Items.Select(item => item.Id));
        }

        seen.Count.ShouldBe(5);
        seen.ToHashSet().SetEquals(ids).ShouldBeTrue();
    }

    [Theory]
    [InlineData("pageSize=100", HttpStatusCode.OK)]
    [InlineData("pageSize=101", HttpStatusCode.BadRequest)]
    [InlineData("pageSize=0", HttpStatusCode.BadRequest)]
    [InlineData("page=100000", HttpStatusCode.OK)]
    [InlineData("page=100001", HttpStatusCode.BadRequest)]
    [InlineData("page=0", HttpStatusCode.BadRequest)]
    public async Task ThePageAndSizeCapsHoldAtTheirEdges(string query, HttpStatusCode expected)
    {
        await using var rig = await Rig.StartAsync(database);

        using var response = await ExpenseFixtures.ListAsync(rig.Client, rig.Admin.AccessToken, query);

        response.StatusCode.ShouldBe(expected);
    }

    [Fact]
    public async Task ASearchOfOneHundredCharactersPassesAndOneHundredAndOneIsA400()
    {
        await using var rig = await Rig.StartAsync(database);

        using var accepted = await ExpenseFixtures.ListAsync(rig.Client, rig.Admin.AccessToken, $"q={new string('a', 100)}");
        using var refused = await ExpenseFixtures.ListAsync(rig.Client, rig.Admin.AccessToken, $"q={new string('a', 101)}");

        accepted.StatusCode.ShouldBe(HttpStatusCode.OK);
        refused.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(refused, TestContext.Current.CancellationToken);
        ExpenseFixtures.FieldErrors(problem, "q").ShouldBe(["Use 100 characters or fewer."]);
    }

    [Fact]
    public async Task OnlyOneDateIsA400ThatAsksForBothOrNeither()
    {
        await using var rig = await Rig.StartAsync(database);

        using var response = await ExpenseFixtures.ListAsync(rig.Client, rig.Admin.AccessToken, "from=2026-09-01");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("company-expenses.invalid-request");
        ExpenseFixtures.FieldErrors(problem, "to").ShouldBe(["Enter both dates, or neither."]);
    }

    [Fact]
    public async Task AStartAfterTheEndIsA400OnTheStart()
    {
        await using var rig = await Rig.StartAsync(database);

        using var response = await ExpenseFixtures.ListAsync(rig.Client, rig.Admin.AccessToken, "from=2026-10-02&to=2026-10-01");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.FieldErrors(problem, "from").ShouldBe(["The start date must be on or before the end date."]);
    }

    [Fact]
    public async Task ADateThatIsNotARealDayIsA400()
    {
        await using var rig = await Rig.StartAsync(database);

        using var response = await ExpenseFixtures.ListAsync(rig.Client, rig.Admin.AccessToken, "from=2026-02-30&to=2026-03-01");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.FieldErrors(problem, "from").ShouldBe(["Enter a real date."]);
    }

    [Fact]
    public async Task ACategoryThatIsNotAnIdIsA400()
    {
        await using var rig = await Rig.StartAsync(database);

        using var response = await ExpenseFixtures.ListAsync(rig.Client, rig.Admin.AccessToken, "category=not-a-guid");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.FieldErrors(problem, "category").ShouldBe(["Choose a category from the list."]);
    }

    [Fact]
    public async Task AnAdminCanEditWhatTheyRecordedOrPayAndAManagerCanEditEverything()
    {
        await using var rig = await Rig.StartAsync(database);
        var recordedByAdmin = await rig.SeedAsync(database, "Recorded by admin", paidBy: rig.Manager.UserId, recordedBy: rig.Admin.UserId);
        var paidByAdmin = await rig.SeedAsync(database, "Paid by admin", paidBy: rig.Admin.UserId, recordedBy: rig.Manager.UserId);
        var neither = await rig.SeedAsync(database, "Neither", paidBy: rig.Manager.UserId, recordedBy: rig.Manager.UserId);
        var system = await rig.SeedAsync(database, "System row", paidBy: rig.Manager.UserId, recordedBy: Rig.NoRecorder);

        var asAdmin = (await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken)).Items.ToDictionary(item => item.Id, item => item.CanEdit);
        var asManager = (await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Manager.AccessToken)).Items.ToDictionary(item => item.Id, item => item.CanEdit);

        asAdmin[recordedByAdmin].ShouldBeTrue();
        asAdmin[paidByAdmin].ShouldBeTrue();
        asAdmin[neither].ShouldBeFalse();
        asAdmin[system].ShouldBeFalse();
        asManager.Values.ShouldAllBe(canEdit => canEdit);
        asManager.Count.ShouldBe(4);
    }

    [Fact]
    public async Task ARowWithNoRecorderShowsNullAndEachItemNamesItsPeople()
    {
        await using var rig = await Rig.StartAsync(database);
        var system = await rig.SeedAsync(database, "System row", paidBy: rig.Manager.UserId, recordedBy: Rig.NoRecorder);
        var named = await rig.SeedAsync(database, "Named row", date: Today.AddDays(-1), paidBy: rig.Admin.UserId, recordedBy: rig.Manager.UserId);

        var page = await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Admin.AccessToken);

        var systemItem = page.Items.Single(item => item.Id == system);
        systemItem.RecordedBy.ShouldBeNull();
        systemItem.PaidBy.Id.ShouldBe(rig.Manager.UserId);
        var namedItem = page.Items.Single(item => item.Id == named);
        namedItem.RecordedBy.ShouldNotBeNull().Id.ShouldBe(rig.Manager.UserId);
        namedItem.PaidBy.Id.ShouldBe(rig.Admin.UserId);
        namedItem.PaidBy.FormerStaff.ShouldBeFalse();
        namedItem.Category.Name.ShouldBe("Supplies");
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

        public CspsApiFactory Host => _baseFactory;

        public HttpClient Client { get; }

        public StartedSession Admin { get; }

        public StartedSession Manager { get; }

        public static Guid NoRecorder => Guid.Empty;

        public static async Task<Rig> StartAsync(CspsDatabase database)
        {
            await database.ResetAsync();
            var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
            var admin = await TestSessions.StartAsync(baseFactory, Roles.Admin);
            var manager = await TestSessions.StartAsync(baseFactory, Roles.Manager);
            return new Rig(baseFactory, AuthClient.WithClock(baseFactory, new FakeTimeProvider(FixedNow)), admin, manager);
        }

        // Writes one expense with the defaults of these tests: today, paid by the Admin, recorded by the Manager, in Supplies.
        public Task<Guid> SeedAsync(
            CspsDatabase database,
            string description,
            DateOnly? date = null,
            Guid? paidBy = null,
            Guid? recordedBy = null,
            Guid? categoryId = null,
            decimal amount = 10.00m,
            string? notes = null) =>
            ExpenseFixtures.SeedAsync(
                database,
                new ExpenseSeed(
                    date ?? Today,
                    paidBy ?? Admin.UserId,
                    recordedBy == NoRecorder ? null : recordedBy ?? Manager.UserId,
                    FixedNow.AddHours(-1),
                    categoryId ?? ExpenseFixtures.SuppliesId,
                    description,
                    amount,
                    notes));

        public string TokenOf(string role) => role == Roles.Admin ? Admin.AccessToken : Manager.AccessToken;

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await _factory.DisposeAsync();
            await _baseFactory.DisposeAsync();
        }
    }
}
