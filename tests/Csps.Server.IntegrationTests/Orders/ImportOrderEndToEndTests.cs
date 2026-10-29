using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using Csps.Domain.Orders;
using Csps.Server.IntegrationTests.Auth;
using Csps.Testing;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-21, ORD-14: a legacy order comes in as it was, with exact figures, and the numbers after it never collide.</summary>
public sealed class ImportOrderEndToEndTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Start = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task TheLegacyOrd0148ImportsVerbatimWithTheExactFiguresAndTheNextNewOrderIsOrd0149()
    {
        await using var rig = await Rig.StartAsync(database, Start);

        var imported = await rig.ImportAsync(Ord0148(rig.Today));

        imported.IsSuccess.ShouldBeTrue(imported.IsFailure ? imported.Error.Message : null);
        var read = await OrderFixtures.ReadDetailAsync(rig.Client, rig.Admin.AccessToken, imported.Value);
        read.GetProperty("number").GetString().ShouldBe("ORD-2026-0148");
        read.GetProperty("status").GetString().ShouldBe("production");
        var totals = read.GetProperty("totals");
        totals.GetProperty("subtotal").GetDecimal().ShouldBe(22450.00m);
        totals.GetProperty("discount").GetDecimal().ShouldBe(1122.50m);
        totals.GetProperty("total").GetDecimal().ShouldBe(21327.50m);
        totals.GetProperty("paid").GetDecimal().ShouldBe(12000.00m);
        totals.GetProperty("balance").GetDecimal().ShouldBe(9327.50m);
        totals.GetProperty("expenses").GetDecimal().ShouldBe(6065.00m);
        totals.GetProperty("profit").GetDecimal().ShouldBe(15262.50m);
        read.GetProperty("items").GetArrayLength().ShouldBe(5);
        var payments = read.GetProperty("payments").EnumerateArray().ToList();
        payments.Count.ShouldBe(2);
        payments.ShouldAllBe(payment => payment.GetProperty("receivedBy").GetProperty("name").GetString() == "Legacy / unassigned");
        read.GetProperty("expenses").GetArrayLength().ShouldBe(3);

        var created = await OrderFixtures.CreateAsync(rig.Client, rig.Admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, rig.Today));

        created.GetProperty("number").GetString().ShouldBe("ORD-2026-0149");
    }

    /// <summary>The legacy ORD-2026-0148 as import data: five lines, the 5% league discount, two payments and three expenses, all held by the Legacy holder.</summary>
    internal static OrderImportSnapshot Ord0148(DateOnly today) => new(
        "ORD-2026-0148",
        new OrderDetails("Juan Dela Cruz", "Brgy. San Roque Ballers", "0917 123 4567", "juan.dc@example.com", null, today.AddDays(-10), today.AddDays(4), null),
        OrderStatus.InProduction,
        [
            new NewOrderItem(OrderFixtures.BasketballId, "Jersey top", "S-XL", 15, 650.00m),
            new NewOrderItem(OrderFixtures.BasketballId, "Jersey shorts", "S-XL", 15, 300.00m),
            new NewOrderItem(OrderFixtures.PoloId, "Coach polo", "L", 2, 550.00m),
            new NewOrderItem(OrderFixtures.LongSleevesId, "Warm-up long sleeves", "M-XL", 15, 420.00m),
            new NewOrderItem(OrderFixtures.CustomDesignId, "Team banner", null, 1, 800.00m),
        ])
    {
        Discounts = [new NewOrderDiscount(DiscountKind.Percentage, 5m, "Barangay league discount")],
        Payments =
        [
            new NewOrderPayment(today.AddDays(-3), 10000.00m, OrderFixtures.GCashId, "9012 345 678901", "50% downpayment", LegacyHolder.Id),
            new NewOrderPayment(today.AddDays(-1), 2000.00m, OrderFixtures.CashId, null, "For 2 added coach polos", LegacyHolder.Id),
        ],
        Expenses =
        [
            new NewOrderExpense(today.AddDays(-6), 3825.00m, OrderFixtures.FabricId, "Dri-fit mesh, 45 yds", LegacyHolder.Id),
            new NewOrderExpense(today.AddDays(-5), 1640.00m, OrderFixtures.InkAndPaperId, "Sublimation ink + transfer paper", LegacyHolder.Id),
            new NewOrderExpense(today.AddDays(-3), 600.00m, OrderFixtures.OutsourcingId, "Embroidery, coach polos", LegacyHolder.Id),
        ],
        StatusHistory = [new ImportedStatusChange(null, OrderStatus.InProduction, null, Start.AddDays(-9))],
    };

    // A host whose clock is pinned, with an Admin signed in and the import handler resolved from its own scope.
    private sealed class Rig : IAsyncDisposable
    {
        private readonly CspsApiFactory _baseFactory;
        private readonly WebApplicationFactory<Program> _factory;

        private Rig(CspsApiFactory baseFactory, WebApplicationFactory<Program> factory, StartedSession admin, DateOnly today)
        {
            _baseFactory = baseFactory;
            _factory = factory;
            Client = factory.CreateClient();
            Admin = admin;
            Today = today;
        }

        public HttpClient Client { get; }

        public StartedSession Admin { get; }

        public DateOnly Today { get; }

        public static async Task<Rig> StartAsync(CspsDatabase database, DateTimeOffset start)
        {
            await database.ResetAsync();
            var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
            WebApplicationFactory<Program>? factory = null;
            try
            {
                var clock = new FakeTimeProvider(start);

                // The bearer check reads the wall clock; judge a token's lifetime by the test clock instead.
                factory = AuthClient.WithClock(baseFactory, clock).WithWebHostBuilder(builder => builder.ConfigureTestServices(
                    services => services.PostConfigureAll<JwtBearerOptions>(options =>
                        options.TokenValidationParameters.LifetimeValidator = (notBefore, expires, _, parameters) =>
                        {
                            var now = clock.GetUtcNow().UtcDateTime;
                            return (notBefore is null || now + parameters.ClockSkew >= notBefore) && (expires is null || now - parameters.ClockSkew <= expires);
                        })));
                var admin = await TestSessions.StartAsync(factory, Roles.Admin);
                var scope = factory.Services.CreateAsyncScope();
                await using (scope)
                {
                    var calendar = scope.ServiceProvider.GetRequiredService<IBusinessCalendar>();
                    var today = (await calendar.GetClockAsync(TestContext.Current.CancellationToken)).Today;
                    return new Rig(baseFactory, factory, admin, today);
                }
            }
            catch
            {
                if (factory is not null)
                {
                    await factory.DisposeAsync();
                }

                await baseFactory.DisposeAsync();
                throw;
            }
        }

        public async Task<Result<Guid>> ImportAsync(OrderImportSnapshot snapshot, OrderImportRules? rules = null)
        {
            var scope = _factory.Services.CreateAsyncScope();
            await using (scope)
            {
                var handler = scope.ServiceProvider.GetRequiredService<ImportOrderHandler>();
                return await handler.HandleAsync(snapshot, rules ?? OrderImportRules.Default, TestContext.Current.CancellationToken);
            }
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await _factory.DisposeAsync();
            await _baseFactory.DisposeAsync();
        }
    }
}
