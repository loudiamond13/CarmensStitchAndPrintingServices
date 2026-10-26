using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Expenses;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Users;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.CompanyExpenses;

/// <summary>CEXP-02, D-07, D-02, T-06-31: a Manager lists the soft-deleted expenses, most recently deleted first; nobody else may.</summary>
public sealed class ListDeletedExpensesEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Recorded = new(2026, 10, 20, 2, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Day = new(2026, 10, 20);
    private static readonly Guid RentId = ExpenseCategorySeed.Rows.Single(row => row.Name == "Rent").Id;

    [Fact]
    public async Task AManagerSeesOnlyDeletedExpensesMostRecentlyDeletedFirstWithEveryMember()
    {
        await using var rig = await Rig.StartAsync(database);
        var oldest = await rig.SeedAsync("Oldest deletion", deletedAt: Recorded.AddHours(1), amount: 100.00m);
        var newest = await rig.SeedAsync("Newest deletion", deletedAt: Recorded.AddHours(5), amount: 300.00m);
        var middle = await rig.SeedAsync("Middle deletion", deletedAt: Recorded.AddHours(3), amount: 200.00m);
        await ExpenseFixtures.SeedAsync(database, new ExpenseSeed(Day, rig.Manager.UserId, rig.Manager.UserId, Recorded, ExpenseFixtures.SuppliesId, "Still live", 50.00m));

        var page = await ExpenseFixtures.ReadDeletedPageAsync(rig.Client, rig.Manager.AccessToken);

        page.Items.Select(item => item.Id).ShouldBe([newest, middle, oldest]);
        page.Total.ShouldBe(3);
        page.Page.ShouldBe(1);
        page.PageSize.ShouldBe(20);
        var first = page.Items[0];
        first.DeletedAt.ShouldBe(Recorded.AddHours(5));
        first.DeletedBy.ShouldNotBeNull().Id.ShouldBe(rig.Manager.UserId);
        first.DeletedBy.FormerStaff.ShouldBeFalse();
        first.Date.ShouldBe(Day);
        first.Category.Name.ShouldBe("Supplies");
        first.Description.ShouldBe("Newest deletion");
        first.Amount.ShouldBe(300.00m);
        first.PaidBy.Id.ShouldBe(rig.Payer.Id);
    }

    [Fact]
    public async Task TheAnswerCarriesNoPeriodTotalAndNoNotes()
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.SeedAsync("With private notes", notes: "Paid cash to Aling Nena");

        using var response = await ExpenseFixtures.ListDeletedAsync(rig.Client, rig.Manager.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(text);
        document.RootElement.TryGetProperty("periodTotal", out _).ShouldBeFalse();
        document.RootElement.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal).ShouldBe(["items", "page", "pageSize", "total"]);
        var item = document.RootElement.GetProperty("items")[0];
        item.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal)
            .ShouldBe(["amount", "category", "date", "deletedAt", "deletedBy", "description", "id", "paidBy"]);
        text.ShouldNotContain("Nena", Case.Insensitive);
    }

    [Fact]
    public async Task ExpensesDeletedAtTheSameInstantKeepOneStableOrderAcrossPages()
    {
        // SQL Server orders ids its own way, so the test checks the order is stable, not what the order is.
        await using var rig = await Rig.StartAsync(database);
        var same = Recorded.AddHours(2);
        var ids = new[] { await rig.SeedAsync("Tie A", deletedAt: same), await rig.SeedAsync("Tie B", deletedAt: same), await rig.SeedAsync("Tie C", deletedAt: same) };

        var whole = await ExpenseFixtures.ReadDeletedPageAsync(rig.Client, rig.Manager.AccessToken);
        var again = await ExpenseFixtures.ReadDeletedPageAsync(rig.Client, rig.Manager.AccessToken);
        var pieces = new List<Guid>();
        for (var page = 1; page <= 3; page++)
        {
            var single = await ExpenseFixtures.ReadDeletedPageAsync(rig.Client, rig.Manager.AccessToken, $"pageSize=1&page={page}");
            pieces.Add(single.Items.ShouldHaveSingleItem().Id);
        }

        whole.Items.Select(item => item.Id).Order().ShouldBe(ids.Order());
        again.Items.Select(item => item.Id).ShouldBe(whole.Items.Select(item => item.Id));
        pieces.ShouldBe(whole.Items.Select(item => item.Id));
    }

    [Fact]
    public async Task AnExpenseWithNoDeleterReadsAsNullAndADeletedPersonKeepsTheirName()
    {
        await using var rig = await Rig.StartAsync(database);
        var tag = UserFixtures.NewTag();
        var gone = await UserFixtures.CreateAsync(rig.Host, tag, "Gone", "Person", Roles.Admin);
        var byGone = await rig.SeedAsync("Deleted by a person", deletedById: gone.Id, deletedAt: Recorded.AddHours(4));
        var bySystem = await rig.SeedAsync("Deleted by nobody", deletedAt: Recorded.AddHours(2), noDeleter: true);
        await AccountStateFixtures.MarkDeletedAsync(rig.Host, gone.Id);

        var page = await ExpenseFixtures.ReadDeletedPageAsync(rig.Client, rig.Manager.AccessToken);

        var named = page.Items.Single(item => item.Id == byGone).DeletedBy.ShouldNotBeNull();
        named.FormerStaff.ShouldBeTrue();
        named.Name.ShouldBe($"Gone{tag} Person{tag}");
        page.Items.Single(item => item.Id == bySystem).DeletedBy.ShouldBeNull();
    }

    [Fact]
    public async Task SearchFindsTheDescriptionAndThePayerOrRecorderName()
    {
        await using var rig = await Rig.StartAsync(database);
        var tag = UserFixtures.NewTag();
        var payer = await UserFixtures.CreateAsync(rig.Host, tag, "Pia", "Pagaduan", Roles.Admin);
        var recorder = await UserFixtures.CreateAsync(rig.Host, tag, "Ramon", "Rivera", Roles.Admin);
        var byText = await rig.SeedAsync($"Zebra fabric {tag}");
        var byPayer = await rig.SeedAsync("Plain one", paidBy: payer.Id);
        var byRecorder = await rig.SeedAsync("Plain two", recordedBy: recorder.Id);
        await rig.SeedAsync("Unrelated row");

        var text = await ExpenseFixtures.ReadDeletedPageAsync(rig.Client, rig.Manager.AccessToken, $"q=zebra%20fabric%20{tag}");
        var payerName = await ExpenseFixtures.ReadDeletedPageAsync(rig.Client, rig.Manager.AccessToken, $"q=Pia{tag}%20Pagaduan{tag}");
        var recorderName = await ExpenseFixtures.ReadDeletedPageAsync(rig.Client, rig.Manager.AccessToken, $"q=Rivera{tag}");

        text.Items.Select(item => item.Id).ShouldBe([byText]);
        payerName.Items.Select(item => item.Id).ShouldBe([byPayer]);
        recorderName.Items.Select(item => item.Id).ShouldBe([byRecorder]);
    }

    [Fact]
    public async Task ATypedWildcardStaysLiteral()
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.SeedAsync("Fifty percent off");
        await rig.SeedAsync("Fifty cents");

        var page = await ExpenseFixtures.ReadDeletedPageAsync(rig.Client, rig.Manager.AccessToken, "q=%25");

        page.Items.ShouldBeEmpty();
        page.Total.ShouldBe(0);
    }

    [Fact]
    public async Task TheCategoryFilterKeepsOnlyThatCategory()
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.SeedAsync("Supplies row");
        var rent = await rig.SeedAsync("Rent row", categoryId: RentId);

        var page = await ExpenseFixtures.ReadDeletedPageAsync(rig.Client, rig.Manager.AccessToken, $"category={RentId:D}");

        page.Items.Select(item => item.Id).ShouldBe([rent]);
        page.Total.ShouldBe(1);
    }

    [Fact]
    public async Task PagingCoversEveryRowAndTotalCountsAllPages()
    {
        await using var rig = await Rig.StartAsync(database);
        var ids = new List<Guid>();
        for (var index = 0; index < 5; index++)
        {
            ids.Add(await rig.SeedAsync($"Row {index}", deletedAt: Recorded.AddHours(index + 1)));
        }

        var first = await ExpenseFixtures.ReadDeletedPageAsync(rig.Client, rig.Manager.AccessToken, "pageSize=2&page=1");
        var second = await ExpenseFixtures.ReadDeletedPageAsync(rig.Client, rig.Manager.AccessToken, "pageSize=2&page=2");
        var third = await ExpenseFixtures.ReadDeletedPageAsync(rig.Client, rig.Manager.AccessToken, "pageSize=2&page=3");
        var beyond = await ExpenseFixtures.ReadDeletedPageAsync(rig.Client, rig.Manager.AccessToken, "pageSize=2&page=4");

        ids.Reverse();
        first.Items.Select(item => item.Id).ShouldBe(ids.Take(2));
        second.Items.Select(item => item.Id).ShouldBe(ids.Skip(2).Take(2));
        third.Items.Select(item => item.Id).ShouldBe(ids.Skip(4));
        beyond.Items.ShouldBeEmpty();
        new[] { first, second, third, beyond }.ShouldAllBe(page => page.Total == 5);
        second.Page.ShouldBe(2);
        second.PageSize.ShouldBe(2);
    }

    [Theory]
    [InlineData("page=0", "page")]
    [InlineData("page=100001", "page")]
    [InlineData("pageSize=0", "pageSize")]
    [InlineData("pageSize=101", "pageSize")]
    [InlineData("category=not-a-guid", "category")]
    public async Task AnOutOfRangeQueryIsA400NamingTheField(string query, string field)
    {
        await using var rig = await Rig.StartAsync(database);

        using var response = await ExpenseFixtures.ListDeletedAsync(rig.Client, rig.Manager.AccessToken, query);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.ErrorFields(problem).ShouldBe([field]);
    }

    [Theory]
    [InlineData("page=100000")]
    [InlineData("pageSize=100")]
    [InlineData("pageSize=1")]
    public async Task TheEdgesOfTheRangesAreAccepted(string query)
    {
        await using var rig = await Rig.StartAsync(database);

        using var response = await ExpenseFixtures.ListDeletedAsync(rig.Client, rig.Manager.AccessToken, query);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AnAdminIsRefusedAndAnonymousIsUnauthorized()
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.SeedAsync("Hidden from admins");

        using var admin = await ExpenseFixtures.ListDeletedAsync(rig.Client, rig.Admin.AccessToken);
        using var anonymous = await ExpenseFixtures.ListDeletedAsync(rig.Client, null);

        admin.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ARestoredExpenseLeavesTheDeletedList()
    {
        await using var rig = await Rig.StartAsync(database);
        var id = await rig.SeedAsync("Will come back");

        using var restored = await ExpenseFixtures.RestoreAsync(rig.Client, rig.Manager.AccessToken, id);

        restored.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var page = await ExpenseFixtures.ReadDeletedPageAsync(rig.Client, rig.Manager.AccessToken);
        page.Items.ShouldBeEmpty();
    }

    // One Admin and one Manager signed in on a clean database, and a payer to name on the seeded rows.
    private sealed class Rig : IAsyncDisposable
    {
        private readonly CspsDatabase _database;

        private Rig(CspsDatabase database, CspsApiFactory host, StartedSession admin, StartedSession manager, SeededUser payer)
        {
            _database = database;
            Host = host;
            Client = host.CreateClient();
            Admin = admin;
            Manager = manager;
            Payer = payer;
        }

        public CspsApiFactory Host { get; }

        public HttpClient Client { get; }

        public StartedSession Admin { get; }

        public StartedSession Manager { get; }

        public SeededUser Payer { get; }

        public static async Task<Rig> StartAsync(CspsDatabase database)
        {
            await database.ResetAsync();
            var host = CspsApiFactory.ForDatabase(database.ConnectionString);
            try
            {
                var admin = await TestSessions.StartAsync(host, Roles.Admin);
                var manager = await TestSessions.StartAsync(host, Roles.Manager);
                var payer = await UserFixtures.CreateAsync(host, UserFixtures.NewTag(), "Pat", "Payer", Roles.Admin);
                return new Rig(database, host, admin, manager, payer);
            }
            catch
            {
                // The rig owns the host only once it exists; before that a failed setup stops it here.
                await host.DisposeAsync();
                throw;
            }
        }

        // Writes one soft-deleted expense: paid by the default payer, recorded and deleted by the Manager unless told otherwise.
        // noDeleter writes a row with no recorder and no deleter, which reads as System.
        public Task<Guid> SeedAsync(
            string description,
            DateTimeOffset? deletedAt = null,
            Guid? paidBy = null,
            Guid? recordedBy = null,
            Guid? deletedById = null,
            Guid? categoryId = null,
            decimal amount = 10.00m,
            string? notes = null,
            bool noDeleter = false) =>
            ExpenseFixtures.SeedAsync(
                _database,
                new ExpenseSeed(
                    Day,
                    paidBy ?? Payer.Id,
                    noDeleter ? null : recordedBy ?? Manager.UserId,
                    Recorded,
                    categoryId ?? ExpenseFixtures.SuppliesId,
                    description,
                    amount,
                    notes,
                    Deleted: true,
                    DeletedById: noDeleter ? null : deletedById ?? Manager.UserId,
                    DeletedAtUtc: deletedAt));

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await Host.DisposeAsync();
        }
    }
}
