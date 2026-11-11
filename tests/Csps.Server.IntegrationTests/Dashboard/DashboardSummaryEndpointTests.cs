using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Expenses;
using Csps.Domain.Orders;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.Dashboard;

/// <summary>DASH-01, 07 D-01, D-12, D-13: one live call gives the business today, the greeting part, the caller's first name and the order figures.</summary>
public sealed class DashboardSummaryEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/dashboard/summary";

    // 09:30 in Manila on Wednesday 2026-11-04.
    private static readonly DateTimeOffset NineThirtyManila = new(2026, 11, 4, 1, 30, 0, TimeSpan.Zero);

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task AManagerGetsTheBusinessTodayTheMorningGreetingAndTheirOwnFirstName()
    {
        await using var rig = await Rig.StartAsync(database, NineThirtyManila);
        await Rig.RenameAsync(database, rig.Manager.UserId, "Carmen");

        var summary = await rig.ReadAsync(rig.Manager.AccessToken);

        summary.GetProperty("today").GetString().ShouldBe("2026-11-04");
        summary.GetProperty("greeting").GetString().ShouldBe("morning");
        summary.GetProperty("firstName").GetString().ShouldBe("Carmen");
    }

    [Theory]
    [InlineData(5, 0, "afternoon")]
    [InlineData(10, 0, "evening")]
    [InlineData(3, 59, "morning")]
    public async Task TheGreetingPartFollowsTheManilaClock(int hour, int minute, string expected)
    {
        await using var rig = await Rig.StartAsync(database, new DateTimeOffset(2026, 11, 4, hour, minute, 0, TimeSpan.Zero));

        var summary = await rig.ReadAsync(rig.Manager.AccessToken);

        summary.GetProperty("greeting").GetString().ShouldBe(expected);
    }

    [Fact]
    public async Task AnAdminGetsTheirOwnFirstNameAndTheManagerGetsTheirs()
    {
        await using var rig = await Rig.StartAsync(database, NineThirtyManila);
        await Rig.RenameAsync(database, rig.Admin.UserId, "Liza");
        await Rig.RenameAsync(database, rig.Manager.UserId, "Carmen");

        var forAdmin = await rig.ReadAsync(rig.Admin.AccessToken);
        var forManager = await rig.ReadAsync(rig.Manager.AccessToken);

        forAdmin.GetProperty("firstName").GetString().ShouldBe("Liza");
        forManager.GetProperty("firstName").GetString().ShouldBe("Carmen");
    }

    [Fact]
    public async Task ActiveCountsPendingToDeliveredAndLeavesOutEndStatesAndDeletedOrders()
    {
        await using var rig = await Rig.StartAsync(database, NineThirtyManila);
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0001", OrderStatus.Pending));
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0002", OrderStatus.Pending));
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0003", OrderStatus.Delivered));
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0004", OrderStatus.Completed));
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0005", OrderStatus.Cancelled));
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0006", OrderStatus.Pending) { Deleted = true });

        var summary = await rig.ReadAsync(rig.Admin.AccessToken);

        summary.GetProperty("orders").GetProperty("active").GetInt32().ShouldBe(3);
    }

    [Fact]
    public async Task TheAnswerCarriesTheWeekOverdueReceivablesCollectedAndExpenseFigures()
    {
        await using var rig = await Rig.StartAsync(database, NineThirtyManila);
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0001", OrderStatus.Pending)
        {
            DueDate = new DateOnly(2026, 11, 5),
            Total = 1000.00m,
            Payments = [new SeedMoney(new DateOnly(2026, 11, 3), 400.00m), new SeedMoney(new DateOnly(2026, 10, 2), 100.00m)],
        });
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0002", OrderStatus.Pending) { DueDate = new DateOnly(2026, 11, 2), Total = 250.00m });
        await rig.SeedExpenseAsync(database, new DateOnly(2026, 11, 3), ExpenseFixtures.SuppliesId, 500.00m);
        await rig.SeedExpenseAsync(database, new DateOnly(2026, 11, 1), ExpenseCategorySeed.Rows.Single(row => row.Name == "Rent").Id, 200.00m);

        var summary = await rig.ReadAsync(rig.Manager.AccessToken);

        var orders = summary.GetProperty("orders");
        orders.GetProperty("active").GetInt32().ShouldBe(2);
        orders.GetProperty("dueThisWeek").GetInt32().ShouldBe(1);
        orders.GetProperty("overdue").GetInt32().ShouldBe(1);
        orders.GetProperty("receivables").GetDecimal().ShouldBe(750.00m);
        var collected = summary.GetProperty("collected");
        collected.GetProperty("thisMonth").GetDecimal().ShouldBe(400.00m);
        collected.GetProperty("comparison").GetDecimal().ShouldBe(100.00m);
        collected.GetProperty("comparisonThrough").GetString().ShouldBe("2026-10-04");
        collected.GetProperty("changePercent").GetInt32().ShouldBe(300);
        var expenses = summary.GetProperty("expenses");
        expenses.GetProperty("thisMonth").GetDecimal().ShouldBe(700.00m);
        expenses.GetProperty("count").GetInt32().ShouldBe(2);
        expenses.GetProperty("topCategory").GetString().ShouldBe("Supplies");
    }

    [Fact]
    public async Task TheStatusesListSixEntriesInFixedOrderAndTheRecentOrdersHoldTheSixNewestCreated()
    {
        await using var rig = await Rig.StartAsync(database, NineThirtyManila);
        var created = new DateTimeOffset(2026, 11, 2, 3, 0, 0, TimeSpan.Zero);
        var statuses = new[]
        {
            OrderStatus.Pending, OrderStatus.Pending, OrderStatus.Mockup, OrderStatus.InProduction,
            OrderStatus.Ready, OrderStatus.Delivered, OrderStatus.Completed, OrderStatus.Cancelled,
        };
        for (var index = 0; index < statuses.Length; index++)
        {
            await rig.SeedAsync(database, new SeedOrder($"ORD-2026-{index + 1:D4}", statuses[index])
            {
                CreatedAtUtc = created.AddMinutes(index),
                StatusChangedAtUtc = statuses[index] == OrderStatus.Completed ? new DateTimeOffset(2026, 11, 3, 3, 0, 0, TimeSpan.Zero) : null,
            });
        }

        var summary = await rig.ReadAsync(rig.Manager.AccessToken);

        var listed = summary.GetProperty("statuses").EnumerateArray().Select(entry => (entry.GetProperty("status").GetString(), entry.GetProperty("count").GetInt32())).ToList();
        listed.ShouldBe([("pending", 2), ("mockup", 1), ("production", 1), ("ready", 1), ("delivered", 1), ("completed", 1)]);
        var recent = summary.GetProperty("recentOrders").EnumerateArray().ToList();
        recent.Select(order => order.GetProperty("number").GetString()).ShouldBe(["ORD-2026-0008", "ORD-2026-0007", "ORD-2026-0006", "ORD-2026-0005", "ORD-2026-0004", "ORD-2026-0003"]);
        recent[0].GetProperty("status").GetString().ShouldBe("cancelled");
        recent[0].GetProperty("balance").GetDecimal().ShouldBe(1000.00m);
        recent[0].GetProperty("cover").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task AnAdminAndAManagerGetTheSameFiguresStatusesAndRecentOrdersAtTheSameInstant()
    {
        await using var rig = await Rig.StartAsync(database, NineThirtyManila);
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0001", OrderStatus.Pending) { DueDate = new DateOnly(2026, 11, 5), Payments = [new SeedMoney(new DateOnly(2026, 11, 3), 250.00m)] });
        await rig.SeedAsync(database, new SeedOrder("ORD-2026-0002", OrderStatus.Delivered) { DueDate = new DateOnly(2026, 11, 2) });
        await rig.SeedExpenseAsync(database, new DateOnly(2026, 11, 3), ExpenseFixtures.SuppliesId, 500.00m);

        var forAdmin = await rig.ReadAsync(rig.Admin.AccessToken);
        var forManager = await rig.ReadAsync(rig.Manager.AccessToken);

        foreach (var name in new[] { "today", "orders", "collected", "expenses", "statuses", "recentOrders" })
        {
            forAdmin.GetProperty(name).GetRawText().ShouldBe(forManager.GetProperty(name).GetRawText(), name);
        }
    }

    [Fact]
    public async Task WithNoComparisonMoneyThePercentIsNullAndWithNoExpensesThereIsNoTopCategory()
    {
        await using var rig = await Rig.StartAsync(database, NineThirtyManila);

        var summary = await rig.ReadAsync(rig.Admin.AccessToken);

        summary.GetProperty("collected").GetProperty("changePercent").ValueKind.ShouldBe(JsonValueKind.Null);
        summary.GetProperty("expenses").GetProperty("topCategory").ValueKind.ShouldBe(JsonValueKind.Null);
        summary.GetProperty("expenses").GetProperty("count").GetInt32().ShouldBe(0);
    }

    [Fact]
    public async Task TheAnswerIsNeverCached()
    {
        await using var rig = await Rig.StartAsync(database, NineThirtyManila);

        using var response = await rig.GetAsync(rig.Manager.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
    }

    [Fact]
    public async Task AnAnonymousCallerGets401()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = baseFactory.CreateClient();
        using var request = ApiRequests.Get(Route);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

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

        public async Task<HttpResponseMessage> GetAsync(string? accessToken)
        {
            using var request = ApiRequests.Get(Route, accessToken);
            return await Client.SendAsync(request, TestContext.Current.CancellationToken);
        }

        public async Task<JsonElement> ReadAsync(string accessToken)
        {
            using var response = await GetAsync(accessToken);
            var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
            return JsonSerializer.Deserialize<JsonElement>(text, Web);
        }

        public static async Task RenameAsync(CspsDatabase db, Guid userId, string firstName)
        {
            await using var context = db.CreateContext();
            await context.Users.Where(user => user.Id == userId)
                .ExecuteUpdateAsync(set => set.SetProperty(user => user.FirstName, firstName), TestContext.Current.CancellationToken);
        }

        public Task<Guid> SeedAsync(CspsDatabase db, SeedOrder order) => OrderSeeding.AddAsync(db, order, Manager.UserId, _now);

        public Task<Guid> SeedExpenseAsync(CspsDatabase db, DateOnly date, Guid categoryId, decimal amount) =>
            ExpenseFixtures.SeedAsync(db, new ExpenseSeed(date, Admin.UserId, Manager.UserId, _now.AddDays(-2), categoryId, $"Row {date:MM-dd}", amount));

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
