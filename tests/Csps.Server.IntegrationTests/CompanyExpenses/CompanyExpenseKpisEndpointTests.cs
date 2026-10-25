using System.Net;
using Csps.Application.Security;
using Csps.Domain.Expenses;
using Csps.Server.IntegrationTests.Auth;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.CompanyExpenses;

/// <summary>CEXP-03, D-24, D-01: the month KPIs follow the Manila month, count by expense date and never count deleted rows.</summary>
public sealed class CompanyExpenseKpisEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    // 07:00 in Manila on 2026-11-01, so the business month is November while the UTC month is still October.
    private static readonly DateTimeOffset AfterManilaMidnight = new(2026, 10, 31, 23, 0, 0, TimeSpan.Zero);

    // 23:59:59 in Manila on 2026-10-31: the last second of October.
    private static readonly DateTimeOffset BeforeManilaMidnight = new(2026, 10, 31, 15, 59, 59, TimeSpan.Zero);

    private static readonly Guid RentId = ExpenseCategorySeed.Rows.Single(row => row.Name == "Rent").Id;
    private static readonly Guid EquipmentId = ExpenseCategorySeed.Rows.Single(row => row.Name == "Equipment").Id;

    [Theory]
    [InlineData(Roles.Admin)]
    [InlineData(Roles.Manager)]
    public async Task BothRolesReadThisMonthLastMonthAndTheTopCategoryAfterManilaMidnight(string role)
    {
        await using var rig = await Rig.StartAsync(database, AfterManilaMidnight);
        await rig.SeedMixedMonthsAsync(database);

        var kpis = await ExpenseFixtures.ReadKpisAsync(rig.Client, rig.TokenOf(role));

        kpis.Today.ShouldBe(new DateOnly(2026, 11, 1));
        kpis.ThisMonth.ShouldBe(new ListedMonthKpi(new DateOnly(2026, 11, 1), 700.00m, 2));
        kpis.LastMonth.ShouldBe(new ListedMonthKpi(new DateOnly(2026, 10, 1), 300.00m, 1));
        var top = kpis.TopCategory.ShouldNotBeNull();
        top.Category.Name.ShouldBe("Supplies");
        top.Category.Id.ShouldBe(ExpenseFixtures.SuppliesId);
        top.Total.ShouldBe(500.00m);
        top.SharePercent.ShouldBe(71);
    }

    [Fact]
    public async Task TheLastSecondOfOctoberInManilaIsStillOctober()
    {
        await using var rig = await Rig.StartAsync(database, BeforeManilaMidnight);
        await rig.SeedMixedMonthsAsync(database);

        var kpis = await ExpenseFixtures.ReadKpisAsync(rig.Client, rig.Admin.AccessToken);

        kpis.Today.ShouldBe(new DateOnly(2026, 10, 31));
        kpis.ThisMonth.ShouldBe(new ListedMonthKpi(new DateOnly(2026, 10, 1), 300.00m, 1));
        kpis.LastMonth.ShouldBe(new ListedMonthKpi(new DateOnly(2026, 9, 1), 0.00m, 0));
    }

    [Fact]
    public async Task AnAnonymousCallerGets401()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = baseFactory.CreateClient();

        using var response = await ExpenseFixtures.KpisResponseAsync(client, accessToken: null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    private sealed class Rig : IAsyncDisposable
    {
        private readonly CspsApiFactory _baseFactory;
        private readonly WebApplicationFactory<Program> _factory;
        private readonly DateTimeOffset _now;

        private Rig(CspsApiFactory baseFactory, WebApplicationFactory<Program> factory, DateTimeOffset now, StartedSession admin, StartedSession manager)
        {
            _baseFactory = baseFactory;
            _factory = factory;
            _now = now;
            Client = factory.CreateClient();
            Admin = admin;
            Manager = manager;
        }

        public HttpClient Client { get; }

        public StartedSession Admin { get; }

        public StartedSession Manager { get; }

        public static async Task<Rig> StartAsync(CspsDatabase database, DateTimeOffset now)
        {
            await database.ResetAsync();
            var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
            var clockFactory = AuthClient.WithClock(baseFactory, new FakeTimeProvider(now));

            // The sessions start on the fixed-clock host, so the host finds them active at the fixed date. The token lifetime is
            // checked against the system clock, so each token is minted for the real now.
            var admin = await SignInAsync(clockFactory, Roles.Admin);
            var manager = await SignInAsync(clockFactory, Roles.Manager);
            return new Rig(baseFactory, clockFactory, now, admin, manager);
        }

        private static async Task<StartedSession> SignInAsync(WebApplicationFactory<Program> clockFactory, string role)
        {
            var started = await TestSessions.StartAsync(clockFactory, role);
            return started with { AccessToken = TestTokens.For(role, TimeProvider.System, started.UserId, sessionId: started.SessionId) };
        }

        public string TokenOf(string role) => role == Roles.Admin ? Admin.AccessToken : Manager.AccessToken;

        // Nov 1 Supplies 500, Oct 31 Rent 300, Nov 20 Rent 200 (upcoming), Dec 2 Rent 999 (next month), and a deleted Nov 5 Equipment 1,000.
        public async Task SeedMixedMonthsAsync(CspsDatabase db)
        {
            await Seed(db, new DateOnly(2026, 11, 1), ExpenseFixtures.SuppliesId, 500.00m, deleted: false);
            await Seed(db, new DateOnly(2026, 10, 31), RentId, 300.00m, deleted: false);
            await Seed(db, new DateOnly(2026, 11, 20), RentId, 200.00m, deleted: false);
            await Seed(db, new DateOnly(2026, 12, 2), RentId, 999.00m, deleted: false);
            await Seed(db, new DateOnly(2026, 11, 5), EquipmentId, 1000.00m, deleted: true);
        }

        private Task<Guid> Seed(CspsDatabase db, DateOnly date, Guid categoryId, decimal amount, bool deleted) =>
            ExpenseFixtures.SeedAsync(
                db,
                new ExpenseSeed(date, Admin.UserId, Manager.UserId, _now.AddDays(-2), categoryId, $"Row {date:MM-dd}", amount, Deleted: deleted));

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await _factory.DisposeAsync();
            await _baseFactory.DisposeAsync();
        }
    }
}
