using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Orders;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.Dashboard;

/// <summary>DASH-03, D-09, D-10, D-36: one call gives every month of the window with income, expenses and profit computed on the server.</summary>
public sealed class DashboardChartEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/dashboard/chart";

    // 10:00 in Manila on Wednesday 2026-11-04.
    private static readonly DateTimeOffset NovemberFourth = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task SixMonthsComeBackOldestFirstWithIncomeExpensesAndProfit()
    {
        await using var rig = await Rig.StartAsync(database, NovemberFourth);
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0001", OrderStatus.Pending)
        {
            Total = 5000.00m,
            Payments = [new SeedMoney(new DateOnly(2026, 10, 10), 1000.00m), new SeedMoney(new DateOnly(2026, 11, 2), 500.00m)],
            Refunds = [new SeedMoney(new DateOnly(2026, 11, 3), 200.00m)],
            Expenses = [new SeedMoney(new DateOnly(2026, 11, 1), 100.00m)],
        });
        await rig.SeedExpenseAsync(database, new DateOnly(2026, 10, 12), 300.00m);

        var chart = await rig.ReadAsync(rig.Manager.AccessToken, "months=6");

        chart.GetProperty("months").GetInt32().ShouldBe(6);
        Months(chart).ShouldBe(
        [
            ("2026-06", 0.00m, 0.00m, 0.00m),
            ("2026-07", 0.00m, 0.00m, 0.00m),
            ("2026-08", 0.00m, 0.00m, 0.00m),
            ("2026-09", 0.00m, 0.00m, 0.00m),
            ("2026-10", 1000.00m, 300.00m, 700.00m),
            ("2026-11", 300.00m, 100.00m, 200.00m),
        ]);
    }

    [Fact]
    public async Task BothRolesGetTheSameBody()
    {
        await using var rig = await Rig.StartAsync(database, NovemberFourth);
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0001", OrderStatus.Pending) { Payments = [new SeedMoney(new DateOnly(2026, 11, 2), 250.00m)] });
        await rig.SeedExpenseAsync(database, new DateOnly(2026, 11, 3), 80.00m);

        var forAdmin = await rig.ReadAsync(rig.Admin.AccessToken, "months=6");
        var forManager = await rig.ReadAsync(rig.Manager.AccessToken, "months=6");

        forAdmin.GetRawText().ShouldBe(forManager.GetRawText());
    }

    [Fact]
    public async Task AnAnonymousCallerGets401()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = baseFactory.CreateClient();
        using var request = ApiRequests.Get($"{Route}?months=6");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task TwelveMonthsGiveTwelveItemsFromLastDecemberToThisNovember()
    {
        await using var rig = await Rig.StartAsync(database, NovemberFourth);
        await rig.SeedAsync(database, new SeedOrder("ORD-2025-0001", OrderStatus.Pending)
        {
            OrderDate = new DateOnly(2025, 12, 1),
            Total = 5000.00m,
            Payments = [new SeedMoney(new DateOnly(2025, 12, 31), 40.00m), new SeedMoney(new DateOnly(2026, 1, 1), 60.00m)],
        });

        var chart = await rig.ReadAsync(rig.Admin.AccessToken, "months=12");

        chart.GetProperty("months").GetInt32().ShouldBe(12);
        var items = Months(chart);
        items.Count.ShouldBe(12);
        items[0].ShouldBe(("2025-12", 40.00m, 0.00m, 40.00m));
        items[1].ShouldBe(("2026-01", 60.00m, 0.00m, 60.00m));
        items[^1].Month.ShouldBe("2026-11");
    }

    [Fact]
    public async Task NoMonthsParameterMeansSix()
    {
        await using var rig = await Rig.StartAsync(database, NovemberFourth);

        var chart = await rig.ReadAsync(rig.Manager.AccessToken, string.Empty);

        chart.GetProperty("months").GetInt32().ShouldBe(6);
        Months(chart).Select(item => item.Month).ShouldBe(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    }

    [Theory]
    [InlineData("7")]
    [InlineData("0")]
    [InlineData("-6")]
    [InlineData("1000")]
    [InlineData("abc")]
    public async Task AnyWindowOtherThanSixOrTwelveIsA400OnMonths(string months)
    {
        await using var rig = await Rig.StartAsync(database, NovemberFourth);

        using var response = await rig.GetAsync(rig.Manager.AccessToken, $"months={months}");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.ErrorFields(problem).ShouldBe(["months"]);
        ExpenseFixtures.FieldErrors(problem, "months").ShouldBe(["Choose 6 or 12 months."]);
    }

    [Fact]
    public async Task TheCurrentMonthsIncomeEqualsCollectedThisMonthFromTheSummaryAtTheSamePinnedInstant()
    {
        await using var rig = await Rig.StartAsync(database, NovemberFourth);
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0001", OrderStatus.Pending)
        {
            Total = 5000.00m,
            Payments = [new SeedMoney(new DateOnly(2026, 11, 1), 700.00m), new SeedMoney(new DateOnly(2026, 10, 2), 400.00m)],
            Refunds = [new SeedMoney(new DateOnly(2026, 11, 3), 120.00m)],
        });
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0002", OrderStatus.Cancelled)
        {
            Payments = [new SeedMoney(new DateOnly(2026, 11, 4), 200.00m)],
            Refunds = [new SeedMoney(new DateOnly(2026, 11, 2), 50.00m)],
        });
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0003", OrderStatus.Pending)
        {
            Payments = [new SeedMoney(new DateOnly(2026, 11, 2), 999.00m)],
            Deleted = true,
        });

        var chart = await rig.ReadAsync(rig.Manager.AccessToken, "months=6");
        var summary = await rig.ReadSummaryAsync(rig.Manager.AccessToken);

        var collected = summary.GetProperty("collected").GetProperty("thisMonth").GetDecimal();
        collected.ShouldBe(730.00m);
        Months(chart)[^1].Income.ShouldBe(collected);
    }

    [Fact]
    public async Task CancelledOrderMoneyCountsDeletedMoneyDoesNotAndAnExpenseLaterThisMonthCounts()
    {
        await using var rig = await Rig.StartAsync(database, NovemberFourth);
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0001", OrderStatus.Cancelled)
        {
            Total = 5000.00m,
            Payments = [new SeedMoney(new DateOnly(2026, 11, 2), 300.00m)],
            Expenses = [new SeedMoney(new DateOnly(2026, 11, 3), 20.00m)],
        });
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0002", OrderStatus.Pending)
        {
            Total = 5000.00m,
            Payments = [new SeedMoney(new DateOnly(2026, 11, 2), 5000.00m)],
            Refunds = [new SeedMoney(new DateOnly(2026, 11, 2), 4000.00m)],
            Expenses = [new SeedMoney(new DateOnly(2026, 11, 2), 900.00m)],
            Deleted = true,
        });
        await rig.SeedExpenseAsync(database, new DateOnly(2026, 11, 3), 600.00m, deleted: true);
        await rig.SeedExpenseAsync(database, new DateOnly(2026, 11, 25), 80.00m);
        await rig.SeedExpenseAsync(database, new DateOnly(2026, 12, 2), 90.00m);

        var chart = await rig.ReadAsync(rig.Admin.AccessToken, "months=6");

        Months(chart)[^1].ShouldBe(("2026-11", 300.00m, 100.00m, 200.00m));
        Months(chart).Sum(item => item.Expenses).ShouldBe(100.00m);
    }

    [Fact]
    public async Task AtFebruaryTenthSixMonthsRunSeptember2025ToFebruary2026()
    {
        await using var rig = await Rig.StartAsync(database, new DateTimeOffset(2026, 2, 10, 2, 0, 0, TimeSpan.Zero));
        await rig.SeedAsync(database, new SeedOrder("ORD-2025-0001", OrderStatus.Pending)
        {
            OrderDate = new DateOnly(2025, 9, 1),
            Total = 5000.00m,
            Payments = [new SeedMoney(new DateOnly(2025, 8, 31), 1.00m), new SeedMoney(new DateOnly(2025, 9, 1), 5.00m), new SeedMoney(new DateOnly(2026, 2, 9), 7.00m)],
        });
        await rig.SeedExpenseAsync(database, new DateOnly(2026, 2, 28), 12.00m);
        await rig.SeedExpenseAsync(database, new DateOnly(2026, 3, 1), 99.00m);

        var chart = await rig.ReadAsync(rig.Admin.AccessToken, "months=6");

        Months(chart).ShouldBe(
        [
            ("2025-09", 5.00m, 0.00m, 5.00m),
            ("2025-10", 0.00m, 0.00m, 0.00m),
            ("2025-11", 0.00m, 0.00m, 0.00m),
            ("2025-12", 0.00m, 0.00m, 0.00m),
            ("2026-01", 0.00m, 0.00m, 0.00m),
            ("2026-02", 7.00m, 12.00m, -5.00m),
        ]);
    }

    [Fact]
    public async Task At0030ManilaOnNovemberFirstTheLastMonthIsNovemberAndHoldsThePaymentDatedThatDay()
    {
        // 00:30 Manila on Nov 1 is still Oct 31 in UTC.
        await using var rig = await Rig.StartAsync(database, new DateTimeOffset(2026, 10, 31, 16, 30, 0, TimeSpan.Zero));
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0001", OrderStatus.Pending)
        {
            Total = 5000.00m,
            Payments = [new SeedMoney(new DateOnly(2026, 10, 31), 100.00m), new SeedMoney(new DateOnly(2026, 11, 1), 300.00m)],
        });
        await rig.SeedExpenseAsync(database, new DateOnly(2026, 11, 1), 40.00m);

        var chart = await rig.ReadAsync(rig.Manager.AccessToken, "months=6");

        Months(chart).ShouldBe(
        [
            ("2026-06", 0.00m, 0.00m, 0.00m),
            ("2026-07", 0.00m, 0.00m, 0.00m),
            ("2026-08", 0.00m, 0.00m, 0.00m),
            ("2026-09", 0.00m, 0.00m, 0.00m),
            ("2026-10", 100.00m, 0.00m, 100.00m),
            ("2026-11", 300.00m, 40.00m, 260.00m),
        ]);
    }

    [Fact]
    public async Task At2359ManilaOnNovemberThirtiethTheLastMonthIsStillNovember()
    {
        // 23:59 Manila on Nov 30 is 15:59 UTC the same day.
        await using var rig = await Rig.StartAsync(database, new DateTimeOffset(2026, 11, 30, 15, 59, 0, TimeSpan.Zero));
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0001", OrderStatus.Pending)
        {
            Total = 5000.00m,
            Payments = [new SeedMoney(new DateOnly(2026, 11, 30), 250.00m), new SeedMoney(new DateOnly(2026, 12, 1), 900.00m)],
        });

        var chart = await rig.ReadAsync(rig.Manager.AccessToken, "months=6");

        var items = Months(chart);
        items.Select(item => item.Month).ShouldBe(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
        items[^1].ShouldBe(("2026-11", 250.00m, 0.00m, 250.00m));
    }

    private static List<(string Month, decimal Income, decimal Expenses, decimal Profit)> Months(JsonElement chart) =>
    [
        .. chart.GetProperty("items").EnumerateArray().Select(item => (
            item.GetProperty("month").GetString()!,
            item.GetProperty("income").GetDecimal(),
            item.GetProperty("expenses").GetDecimal(),
            item.GetProperty("profit").GetDecimal())),
    ];

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
            WebApplicationFactory<Program>? clockFactory = null;
            try
            {
                clockFactory = AuthClient.WithClock(baseFactory, new FakeTimeProvider(now));

                // The sessions start on the fixed-clock host; the token lifetime is checked against the system clock, so each token is minted for the real now.
                var admin = await SignInAsync(clockFactory, Roles.Admin);
                var manager = await SignInAsync(clockFactory, Roles.Manager);
                return new Rig(baseFactory, clockFactory, now, admin, manager);
            }
            catch
            {
                if (clockFactory is not null)
                {
                    await clockFactory.DisposeAsync();
                }

                await baseFactory.DisposeAsync();
                throw;
            }
        }

        public async Task<HttpResponseMessage> GetAsync(string? accessToken, string query)
        {
            using var request = ApiRequests.Get(query.Length == 0 ? Route : $"{Route}?{query}", accessToken);
            return await Client.SendAsync(request, TestContext.Current.CancellationToken);
        }

        public async Task<JsonElement> ReadAsync(string accessToken, string query)
        {
            using var response = await GetAsync(accessToken, query);
            var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
            return JsonSerializer.Deserialize<JsonElement>(text, Web);
        }

        public async Task<JsonElement> ReadSummaryAsync(string accessToken)
        {
            using var request = ApiRequests.Get("/api/v1/dashboard/summary", accessToken);
            using var response = await Client.SendAsync(request, TestContext.Current.CancellationToken);
            var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
            return JsonSerializer.Deserialize<JsonElement>(text, Web);
        }

        public Task<Guid> SeedAsync(CspsDatabase db, SeedOrder order) => OrderSeeding.AddAsync(db, order, Manager.UserId, _now);

        public Task<Guid> SeedExpenseAsync(CspsDatabase db, DateOnly date, decimal amount, bool deleted = false) =>
            ExpenseFixtures.SeedAsync(db, new ExpenseSeed(date, Admin.UserId, Manager.UserId, _now.AddDays(-2), ExpenseFixtures.SuppliesId, $"Row {date:MM-dd}", amount, Deleted: deleted));

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await _factory.DisposeAsync();
            await _baseFactory.DisposeAsync();
        }

        private static async Task<StartedSession> SignInAsync(WebApplicationFactory<Program> clockFactory, string role)
        {
            var started = await TestSessions.StartAsync(clockFactory, role);
            return started with { AccessToken = TestTokens.For(role, TimeProvider.System, started.UserId, sessionId: started.SessionId) };
        }
    }
}
