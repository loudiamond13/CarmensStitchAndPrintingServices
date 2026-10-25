using Csps.Application.Security;
using Csps.Domain.Expenses;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.CompanyExpenses;

/// <summary>PERF-04: the expense list and KPI routes run the same number of SQL commands whatever the page size, so no row costs a query.</summary>
public sealed class CompanyExpenseListQueryCountTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int RowCount = 120;

    [Fact]
    public async Task ThePageSizeDoesNotChangeTheNumberOfSqlCommands()
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.SeedRowsAsync(database, RowCount);
        (await ExpenseFixtures.ReadPageAsync(rig.Client, rig.Token)).Items.ShouldNotBeEmpty();

        var small = await rig.CountAsync(() => ExpenseFixtures.ReadPageAsync(rig.Client, rig.Token, "pageSize=10"));
        var large = await rig.CountAsync(() => ExpenseFixtures.ReadPageAsync(rig.Client, rig.Token, "pageSize=100"));

        small.Count.ShouldBeGreaterThan(0, "the counter must be attached, or this test proves nothing");
        large.Count.ShouldBe(small.Count);
        small.Page.Items.Count.ShouldBe(10);
        large.Page.Items.Count.ShouldBe(100);
    }

    [Fact]
    public async Task TheKpisRunTheSameNumberOfSqlCommandsEachTime()
    {
        await using var rig = await Rig.StartAsync(database);
        await rig.SeedRowsAsync(database, RowCount);
        (await ExpenseFixtures.ReadKpisAsync(rig.Client, rig.Token)).Today.ShouldBe(rig.Today);

        var first = await rig.CountAsync(() => ExpenseFixtures.ReadKpisAsync(rig.Client, rig.Token));
        var second = await rig.CountAsync(() => ExpenseFixtures.ReadKpisAsync(rig.Client, rig.Token));

        first.Count.ShouldBeGreaterThan(0, "the counter must be attached, or this test proves nothing");
        second.Count.ShouldBe(first.Count);
    }

    [Fact]
    public async Task ACreateThroughTheCountingHostStillStampsTheCaller()
    {
        await using var rig = await Rig.StartAsync(database);

        var body = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, rig.UserId, rig.Today);
        var created = await ExpenseFixtures.CreateAsync(rig.Client, rig.Token, body);

        var id = created.GetProperty("id").GetGuid();
        await using var context = database.CreateContext();
        var stored = await context.CompanyExpenses.AsNoTracking().SingleAsync(expense => expense.Id == id, TestContext.Current.CancellationToken);
        stored.CreatedById.ShouldBe(rig.UserId);
        rig.Counter.Count.ShouldBeGreaterThan(0);
    }

    private sealed record Counted<T>(int Count, T Page);

    private sealed class Rig : IAsyncDisposable
    {
        private readonly CspsApiFactory _baseFactory;
        private readonly WebApplicationFactory<Program> _factory;

        private Rig(CspsApiFactory baseFactory, WebApplicationFactory<Program> factory, CommandCounter counter, StartedSession session, DateOnly today)
        {
            _baseFactory = baseFactory;
            _factory = factory;
            Counter = counter;
            Client = factory.CreateClient();
            Token = session.AccessToken;
            UserId = session.UserId;
            Today = today;
        }

        public CommandCounter Counter { get; }

        public HttpClient Client { get; }

        public string Token { get; }

        public Guid UserId { get; }

        public DateOnly Today { get; }

        public static async Task<Rig> StartAsync(CspsDatabase database)
        {
            await database.ResetAsync();
            var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
            var counter = new CommandCounter();

            // ConfigureDbContext appends to the options the host registers; the create test proves the stamp interceptor survives.
            var factory = baseFactory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
                services.ConfigureDbContext<CspsDbContext>(options => options.AddInterceptors(counter))));
            var session = await TestSessions.StartAsync(factory, Roles.Manager);
            var today = await ExpenseFixtures.TodayAsync(baseFactory);
            return new Rig(baseFactory, factory, counter, session, today);
        }

        public async Task SeedRowsAsync(CspsDatabase db, int count)
        {
            var recorded = TimeProvider.System.GetUtcNow().AddHours(-2);
            await using var context = db.CreateContext();
            for (var index = 0; index < count; index++)
            {
                var date = Today.AddDays(-(index % 20));
                var expense = CompanyExpense.Create(date, ExpenseFixtures.SuppliesId, $"Expense {index:000}", 50m + index, UserId, null, Today, recorded).Value;
                context.CompanyExpenses.Add(expense);
                var entry = context.Entry(expense);
                entry.Property(row => row.CreatedById).CurrentValue = UserId;
                entry.Property(row => row.CreatedAtUtc).CurrentValue = recorded.AddMinutes(index);
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        public async Task<Counted<T>> CountAsync<T>(Func<Task<T>> request)
        {
            Counter.Reset();
            var page = await request();
            return new Counted<T>(Counter.Count, page);
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await _factory.DisposeAsync();
            await _baseFactory.DisposeAsync();
        }
    }
}
