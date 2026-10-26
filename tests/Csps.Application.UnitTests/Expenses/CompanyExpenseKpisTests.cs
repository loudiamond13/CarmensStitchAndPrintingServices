using Csps.Application.Expenses;
using Csps.Application.Ports;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Expenses;

/// <summary>CEXP-03, D-24: the KPI months come from the business clock, and the top category's share rounds half away from zero.</summary>
public sealed class CompanyExpenseKpisTests
{
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly ExpenseCategoryRef Supplies = new(Guid.Parse("447ad32e-1433-4b70-8786-72e3dc3f9937"), "Supplies", "warning", false);

    [Fact]
    public async Task At0700ManilaOnTheFirstThisMonthIsNovemberAndLastMonthIsOctober()
    {
        var harness = new Harness(new DateTimeOffset(2026, 10, 31, 23, 0, 0, TimeSpan.Zero));

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Today.ShouldBe(new DateOnly(2026, 11, 1));
        result.Value.ThisMonth.Month.ShouldBe(new DateOnly(2026, 11, 1));
        result.Value.LastMonth.Month.ShouldBe(new DateOnly(2026, 10, 1));
        await harness.Reader.Received(1).GetKpisAsync(
            new KpiMonths(new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 30), new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 31)),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task OnTheFirstOfMarchLastMonthIsAFebruaryOf28Days()
    {
        var harness = new Harness(new DateTimeOffset(2026, 3, 1, 0, 0, 0, TimeSpan.FromHours(8)));

        await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        await harness.Reader.Received(1).GetKpisAsync(
            new KpiMonths(new DateOnly(2026, 3, 1), new DateOnly(2026, 3, 31), new DateOnly(2026, 2, 1), new DateOnly(2026, 2, 28)),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task InALeapYearLastMonthEndsOnTheTwentyNinth()
    {
        var harness = new Harness(new DateTimeOffset(2028, 3, 1, 0, 0, 0, TimeSpan.FromHours(8)));

        await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        await harness.Reader.Received(1).GetKpisAsync(
            new KpiMonths(new DateOnly(2028, 3, 1), new DateOnly(2028, 3, 31), new DateOnly(2028, 2, 1), new DateOnly(2028, 2, 29)),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task InJanuaryLastMonthIsDecemberOfThePreviousYear()
    {
        var harness = new Harness(new DateTimeOffset(2027, 1, 15, 4, 0, 0, TimeSpan.Zero));

        await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        await harness.Reader.Received(1).GetKpisAsync(
            new KpiMonths(new DateOnly(2027, 1, 1), new DateOnly(2027, 1, 31), new DateOnly(2026, 12, 1), new DateOnly(2026, 12, 31)),
            Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("500", "700", 71)]
    [InlineData("1", "8", 13)]
    [InlineData("2", "3", 67)]
    [InlineData("700", "700", 100)]
    [InlineData("1", "3", 33)]
    public async Task TheShareRoundsHalfAwayFromZeroToAWholePercent(string topTotal, string monthTotal, int expected)
    {
        var top = decimal.Parse(topTotal, System.Globalization.CultureInfo.InvariantCulture);
        var month = decimal.Parse(monthTotal, System.Globalization.CultureInfo.InvariantCulture);
        var harness = new Harness(new DateTimeOffset(2026, 10, 25, 4, 0, 0, TimeSpan.Zero), new ExpenseKpiTotals(month, 2, 0m, 0, Supplies, top));

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        var kpi = result.Value.TopCategory.ShouldNotBeNull();
        kpi.SharePercent.ShouldBe(expected);
        kpi.Total.ShouldBe(top);
        kpi.Category.ShouldBe(Supplies);
    }

    [Fact]
    public async Task WithNothingThisMonthThereIsNoTopCategoryAndTheTotalIsZero()
    {
        var harness = new Harness(new DateTimeOffset(2026, 10, 25, 4, 0, 0, TimeSpan.Zero), new ExpenseKpiTotals(0m, 0, 125.50m, 3, null, 0m));

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.TopCategory.ShouldBeNull();
        result.Value.ThisMonth.Total.ShouldBe(0m);
        result.Value.ThisMonth.Count.ShouldBe(0);
        result.Value.LastMonth.Total.ShouldBe(125.50m);
        result.Value.LastMonth.Count.ShouldBe(3);
    }

    [Fact]
    public async Task ATopCategoryWithNoMonthTotalIsNotShown()
    {
        var harness = new Harness(new DateTimeOffset(2026, 10, 25, 4, 0, 0, TimeSpan.Zero), new ExpenseKpiTotals(0m, 0, 0m, 0, Supplies, 10m));

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.TopCategory.ShouldBeNull();
    }

    [Fact]
    public async Task TheFiguresOfThePortAreCarriedToTheAnswer()
    {
        var harness = new Harness(new DateTimeOffset(2026, 10, 25, 4, 0, 0, TimeSpan.Zero), new ExpenseKpiTotals(700.00m, 2, 300.00m, 1, Supplies, 500.00m));

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.ThisMonth.ShouldBe(new MonthKpi(new DateOnly(2026, 10, 1), 700.00m, 2));
        result.Value.LastMonth.ShouldBe(new MonthKpi(new DateOnly(2026, 9, 1), 300.00m, 1));
    }

    private sealed class Harness
    {
        public Harness(DateTimeOffset now, ExpenseKpiTotals? totals = null)
        {
            Reader = Substitute.For<ICompanyExpenseReader>();
            Reader.GetKpisAsync(Arg.Any<KpiMonths>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(totals ?? new ExpenseKpiTotals(0m, 0, 0m, 0, null, 0m)));
            Handler = new GetCompanyExpenseKpisHandler(Reader, new FixedCalendar(now));
        }

        public ICompanyExpenseReader Reader { get; }

        public GetCompanyExpenseKpisHandler Handler { get; }
    }

    private sealed class FixedCalendar(DateTimeOffset now) : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, now));
    }
}
