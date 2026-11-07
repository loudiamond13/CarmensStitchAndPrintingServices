using Csps.Application.Auth;
using Csps.Application.Dashboard;
using Csps.Application.Expenses;
using Csps.Application.Images;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Domain.Orders;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Dashboard;

/// <summary>DASH-01, DASH-02, D-05, D-06, D-07, D-54: the summary is built from one clock read, and the percent and expense figures follow the owner's rules.</summary>
public sealed class GetDashboardSummaryHandlerTests
{
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");

    // 09:30 in Manila on Wednesday 2026-11-04.
    private static readonly DateTimeOffset Wednesday = new(2026, 11, 4, 1, 30, 0, TimeSpan.Zero);
    private static readonly ExpenseCategoryRef Supplies = new(Guid.Parse("447ad32e-1433-4b70-8786-72e3dc3f9937"), "Supplies", "warning", false);

    [Fact]
    public async Task WithNoCallerTheSessionHasEndedAndNothingIsRead()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        await harness.Reader.DidNotReceive().GetSummaryAsync(Arg.Any<Guid>(), Arg.Any<DashboardPeriod>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ATokenWhoseUserRowIsGoneIsASessionEnded()
    {
        var harness = new Harness { Figures = FiguresOf() with { FirstName = null } };

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
    }

    [Fact]
    public async Task TheReaderIsAskedForTheTokensUserAndTheWednesdayPeriod()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.AskedFor.ShouldBe(harness.CallerId);
        harness.Asked.ShouldBe(new DashboardPeriod(
            new DateOnly(2026, 11, 4),
            new DateOnly(2026, 11, 2),
            new DateOnly(2026, 11, 8),
            new DateOnly(2026, 11, 1),
            new DateOnly(2026, 11, 30),
            new DateOnly(2026, 10, 1),
            new DateOnly(2026, 10, 4),
            new DateTimeOffset(2026, 10, 31, 16, 0, 0, TimeSpan.Zero),
            new DateTimeOffset(2026, 11, 30, 16, 0, 0, TimeSpan.Zero)));
        result.Value.Today.ShouldBe(new DateOnly(2026, 11, 4));
        result.Value.FirstName.ShouldBe("Carmen");
    }

    [Fact]
    public async Task OnMarchThirtyFirstTheComparisonRunsFebruaryFirstToFebruaryTwentyEighth()
    {
        var harness = new Harness(new DateTimeOffset(2026, 3, 31, 4, 0, 0, TimeSpan.Zero));

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        harness.Asked.ComparisonFirst.ShouldBe(new DateOnly(2026, 2, 1));
        harness.Asked.ComparisonLast.ShouldBe(new DateOnly(2026, 2, 28));
        result.Value.Collected.ComparisonThrough.ShouldBe(new DateOnly(2026, 2, 28));
        await harness.Expenses.Received(1).GetKpisAsync(
            new KpiMonths(new DateOnly(2026, 3, 1), new DateOnly(2026, 3, 31), new DateOnly(2026, 2, 1), new DateOnly(2026, 2, 28)),
            Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(1, 30, "morning")]
    [InlineData(5, 0, "afternoon")]
    [InlineData(10, 0, "evening")]
    public async Task TheGreetingIsMorningAfternoonOrEveningInTheBusinessZone(int hour, int minute, string expected)
    {
        var harness = new Harness(new DateTimeOffset(2026, 11, 4, hour, minute, 0, TimeSpan.Zero));

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Greeting.ShouldBe(expected);
    }

    [Theory]
    [InlineData("1000.00", "1125.00", 13)]
    [InlineData("1000.00", "875.00", -13)]
    [InlineData("-200.00", "100.00", 150)]
    [InlineData("-200.00", "-300.00", -50)]
    [InlineData("1000.00", "1000.00", 0)]
    [InlineData("0.01", "0.00", -100)]
    public async Task TheChangeIsAWholePercentOfTheAbsoluteComparisonRoundedAwayFromZero(string comparison, string thisMonth, int expected)
    {
        var harness = new Harness { Figures = FiguresOf(thisMonth, comparison) };

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Collected.ChangePercent.ShouldBe(expected);
    }

    [Theory]
    [InlineData("0.00", "500.00")]
    [InlineData("0.00", "0.00")]
    public async Task AZeroComparisonGivesNoPercent(string comparison, string thisMonth)
    {
        var harness = new Harness { Figures = FiguresOf(thisMonth, comparison) };

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Collected.ChangePercent.ShouldBeNull();
        result.Value.Collected.ThisMonth.ShouldBe(decimal.Parse(thisMonth, System.Globalization.CultureInfo.InvariantCulture));
    }

    [Fact]
    public async Task AChangeBeyondTheWholeNumberRangeIsHeldAtTheEnd()
    {
        var harness = new Harness { Figures = FiguresOf("900000000000000.00", "0.01") };

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Collected.ChangePercent.ShouldBe(int.MaxValue);
    }

    [Fact]
    public async Task TheOrderAndMoneyFiguresOfThePortAreCarriedToTheAnswer()
    {
        var harness = new Harness { Figures = new DashboardFigures("Carmen", 9, 4, 2, 1234.50m, 1125.00m, 1000.00m, new DashboardStatusCounts(0, 0, 0, 0, 0, 0)) };

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Orders.ShouldBe(new DashboardOrderFigures(9, 4, 2, 1234.50m));
        result.Value.Collected.ShouldBe(new DashboardCollectedFigures(1125.00m, 1000.00m, new DateOnly(2026, 10, 4), 13));
    }

    [Fact]
    public async Task TheExpenseFiguresPassThroughWithTheTopCategoryName()
    {
        var harness = new Harness { Totals = new ExpenseKpiTotals(700.00m, 2, 300.00m, 1, Supplies, 500.00m) };

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Expenses.ShouldBe(new DashboardExpenseFigures(700.00m, 2, "Supplies"));
    }

    [Fact]
    public async Task WithNoExpensesThisMonthThereIsNoTopCategory()
    {
        var harness = new Harness { Totals = new ExpenseKpiTotals(0m, 0, 125.50m, 3, Supplies, 0m) };

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Expenses.ShouldBe(new DashboardExpenseFigures(0m, 0, null));
    }

    [Fact]
    public async Task ExpensesWithNoNamedTopCategoryKeepTheirTotalAndCountAndShowNoName()
    {
        var harness = new Harness { Totals = new ExpenseKpiTotals(700.00m, 2, 0m, 0, null, 0m) };

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Expenses.ShouldBe(new DashboardExpenseFigures(700.00m, 2, null));
    }

    [Fact]
    public async Task TheStatusesAreTheSixShownOnesInFixedOrderWithTheirKeysAndNothingMore()
    {
        var harness = new Harness { Figures = FiguresOf() with { Statuses = new DashboardStatusCounts(3, 1, 4, 2, 5, 7) } };

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Statuses.ShouldBe(
        [
            new DashboardStatusCount("pending", 3),
            new DashboardStatusCount("mockup", 1),
            new DashboardStatusCount("production", 4),
            new DashboardStatusCount("ready", 2),
            new DashboardStatusCount("delivered", 5),
            new DashboardStatusCount("completed", 7),
        ]);
    }

    [Fact]
    public async Task TheSixNewestOrdersAreAskedForAndShapedLikeOrderListEntriesWithTheirCovers()
    {
        var harness = new Harness
        {
            Newest =
            [
                RowOf("ORD-2026-0009", OrderStatus.Delivered),
                RowOf("ORD-2026-0008", OrderStatus.Completed) with { ImageCount = 2, CoverPublicId = "csps/orders/abc123", CoverWidth = 4000, CoverHeight = 3000 },
            ],
        };
        harness.Delivery.ForCover("csps/orders/abc123", 4000, 3000).Returns(
            new CoverUrls(new ImageSource("/card.jpg", "/card.jpg 640w"), new ImageSource("/table.jpg", "/table.jpg 1x")));

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        await harness.Orders.Received(1).ListNewestAsync(6, Arg.Any<CancellationToken>());
        result.Value.RecentOrders.Select(entry => (entry.Number, entry.Status)).ShouldBe([("ORD-2026-0009", "delivered"), ("ORD-2026-0008", "completed")]);
        result.Value.RecentOrders[0].Cover.ShouldBeNull();
        result.Value.RecentOrders[1].Cover.ShouldBe(new OrderCoverResponse(new ImageSourceResponse("/card.jpg", "/card.jpg 640w"), new ImageSourceResponse("/table.jpg", "/table.jpg 1x"), 4000, 3000));
    }

    [Fact]
    public async Task WithNoOrdersTheRecentListIsEmpty()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.RecentOrders.ShouldBeEmpty();
    }

    private static OrderListRow RowOf(string number, OrderStatus status) =>
        new(Guid.NewGuid(), number, "Juan Dela Cruz", null, new DateOnly(2026, 11, 1), null, status, Wednesday, 100.00m, 0.00m, 100.00m, 0.00m, 0.00m, 100.00m, 0.00m, false, 2, 0, null, null, null);

    private static DashboardFigures FiguresOf(string thisMonth = "0.00", string comparison = "0.00") =>
        new(
            "Carmen",
            0,
            0,
            0,
            0m,
            decimal.Parse(thisMonth, System.Globalization.CultureInfo.InvariantCulture),
            decimal.Parse(comparison, System.Globalization.CultureInfo.InvariantCulture),
            new DashboardStatusCounts(0, 0, 0, 0, 0, 0));

    private sealed class Harness
    {
        public Harness(DateTimeOffset? now = null, bool noCaller = false)
        {
            Reader = Substitute.For<IDashboardReader>();
            Expenses = Substitute.For<ICompanyExpenseReader>();
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Orders = Substitute.For<IOrderReader>();
            Orders.ListNewestAsync(Arg.Any<int>(), Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult(Newest));
            Delivery = Substitute.For<IImageDelivery>();
            Handler = new GetDashboardSummaryHandler(Reader, Orders, Expenses, Delivery, request, new FixedCalendar(now ?? Wednesday));
            Reader.GetSummaryAsync(Arg.Any<Guid>(), Arg.Any<DashboardPeriod>(), Arg.Any<CancellationToken>())
                .Returns(call =>
                {
                    AskedFor = call.ArgAt<Guid>(0);
                    Asked = call.ArgAt<DashboardPeriod>(1);
                    return Task.FromResult(Figures);
                });
            Expenses.GetKpisAsync(Arg.Any<KpiMonths>(), Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult(Totals));
        }

        public Guid CallerId { get; } = Guid.NewGuid();

        public IDashboardReader Reader { get; }

        public IOrderReader Orders { get; }

        public IImageDelivery Delivery { get; }

        public ICompanyExpenseReader Expenses { get; }

        public GetDashboardSummaryHandler Handler { get; }

        public Guid AskedFor { get; private set; }

        public DashboardPeriod Asked { get; private set; } = null!;

        public DashboardFigures Figures { get; set; } = FiguresOf();

        public ExpenseKpiTotals Totals { get; set; } = new(0m, 0, 0m, 0, null, 0m);

        public IReadOnlyList<OrderListRow> Newest { get; set; } = [];
    }

    private sealed class FixedCalendar(DateTimeOffset now) : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, now));
    }
}
