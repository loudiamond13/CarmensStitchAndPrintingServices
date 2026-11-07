using Csps.Application.Auth;
using Csps.Application.Dashboard;
using Csps.Application.Expenses;
using Csps.Application.Ports;
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
        var harness = new Harness { Figures = new DashboardFigures("Carmen", 9, 4, 2, 1234.50m, 1125.00m, 1000.00m) };

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

    private static DashboardFigures FiguresOf(string thisMonth = "0.00", string comparison = "0.00") =>
        new(
            "Carmen",
            0,
            0,
            0,
            0m,
            decimal.Parse(thisMonth, System.Globalization.CultureInfo.InvariantCulture),
            decimal.Parse(comparison, System.Globalization.CultureInfo.InvariantCulture));

    private sealed class Harness
    {
        public Harness(DateTimeOffset? now = null, bool noCaller = false)
        {
            Reader = Substitute.For<IDashboardReader>();
            Expenses = Substitute.For<ICompanyExpenseReader>();
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new GetDashboardSummaryHandler(Reader, Expenses, request, new FixedCalendar(now ?? Wednesday));
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

        public ICompanyExpenseReader Expenses { get; }

        public GetDashboardSummaryHandler Handler { get; }

        public Guid AskedFor { get; private set; }

        public DashboardPeriod Asked { get; private set; } = null!;

        public DashboardFigures Figures { get; set; } = FiguresOf();

        public ExpenseKpiTotals Totals { get; set; } = new(0m, 0, 0m, 0, null, 0m);
    }

    private sealed class FixedCalendar(DateTimeOffset now) : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, now));
    }
}
