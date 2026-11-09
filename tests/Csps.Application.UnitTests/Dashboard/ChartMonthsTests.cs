using Csps.Application.Dashboard;
using Csps.Application.Ports;

namespace Csps.Application.UnitTests.Dashboard;

/// <summary>DASH-03, D-09, D-10, D-36: the chart months are filled, ordered and worked out from the four sums.</summary>
public sealed class ChartMonthsTests
{
    private static readonly IReadOnlyList<MonthSum> None = [];

    [Fact]
    public void TwelveMonthsFromDecember2025RunToNovember2026OldestFirst()
    {
        var items = ChartMonths.Build(new DateOnly(2025, 12, 1), 12, None, None, None, None);

        items.Select(item => item.Month).ShouldBe(
            ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    }

    [Fact]
    public void AnyDayOfTheFirstMonthStartsTheWindowAtThatMonth()
    {
        var items = ChartMonths.Build(new DateOnly(2026, 6, 17), 6, None, None, None, None);

        items.Select(item => item.Month).ShouldBe(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    }

    [Fact]
    public void AnEmptyInputGivesZeroIncomeExpensesAndProfitInEveryMonth()
    {
        var items = ChartMonths.Build(new DateOnly(2026, 6, 1), 6, None, None, None, None);

        items.Count.ShouldBe(6);
        items.ShouldAllBe(item => item.Income == 0m && item.Expenses == 0m && item.Profit == 0m);
    }

    [Fact]
    public void IncomeIsPaymentsMinusRefundsExpensesAreCompanyPlusOrderAndProfitIsTheDifference()
    {
        var items = ChartMonths.Build(
            new DateOnly(2026, 9, 1),
            3,
            [new MonthSum(2026, 10, 1000.00m), new MonthSum(2026, 11, 500.00m)],
            [new MonthSum(2026, 11, 200.00m)],
            [new MonthSum(2026, 10, 300.00m)],
            [new MonthSum(2026, 10, 25.50m), new MonthSum(2026, 11, 100.00m)]);

        items.ShouldBe(
        [
            new DashboardChartMonth("2026-09", 0m, 0m, 0m),
            new DashboardChartMonth("2026-10", 1000.00m, 325.50m, 674.50m),
            new DashboardChartMonth("2026-11", 300.00m, 100.00m, 200.00m),
        ]);
    }

    [Fact]
    public void ARefundLargerThanPaymentsGivesNegativeIncomeAndProfit()
    {
        var items = ChartMonths.Build(new DateOnly(2026, 11, 1), 1, [new MonthSum(2026, 11, 100.00m)], [new MonthSum(2026, 11, 350.00m)], None, None);

        items.Single().ShouldBe(new DashboardChartMonth("2026-11", -250.00m, 0m, -250.00m));
    }

    [Fact]
    public void ExpensesWithNoIncomeGiveANegativeProfit()
    {
        var items = ChartMonths.Build(new DateOnly(2026, 11, 1), 1, None, None, [new MonthSum(2026, 11, 40.00m)], [new MonthSum(2026, 11, 2.25m)]);

        items.Single().ShouldBe(new DashboardChartMonth("2026-11", 0m, 42.25m, -42.25m));
    }

    [Fact]
    public void RowsOutsideTheWindowAreIgnoredAndTwoRowsOfOneMonthAreAdded()
    {
        var items = ChartMonths.Build(
            new DateOnly(2026, 10, 1),
            2,
            [new MonthSum(2026, 9, 99.00m), new MonthSum(2026, 10, 1.00m), new MonthSum(2026, 10, 2.00m), new MonthSum(2026, 12, 99.00m)],
            None,
            None,
            None);

        items.Select(item => item.Income).ShouldBe([3.00m, 0m]);
    }

    [Fact]
    public void TheWindowCrossesAYearEndWithTheRightYearOnEachMonth()
    {
        var items = ChartMonths.Build(new DateOnly(2025, 9, 1), 6, [new MonthSum(2025, 12, 10.00m), new MonthSum(2026, 1, 20.00m)], None, None, None);

        items.Select(item => (item.Month, item.Income)).ShouldBe(
            [("2025-09", 0m), ("2025-10", 0m), ("2025-11", 0m), ("2025-12", 10.00m), ("2026-01", 20.00m), ("2026-02", 0m)]);
    }

    [Fact]
    public void EveryFigureOfAGapMonthKeepsTwoDecimalPlacesSoItSerialisesAs0Point00()
    {
        var items = ChartMonths.Build(new DateOnly(2026, 6, 1), 2, None, None, None, None);

        items.ShouldAllBe(item => item.Income.Scale == 2 && item.Expenses.Scale == 2 && item.Profit.Scale == 2);
        System.Text.Json.JsonSerializer.Serialize(items[0]).ShouldBe("{\"Month\":\"2026-06\",\"Income\":0.00,\"Expenses\":0.00,\"Profit\":0.00}");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void AMonthCountBelowOneIsRefused(int months)
    {
        var error = Should.Throw<ArgumentOutOfRangeException>(() => ChartMonths.Build(new DateOnly(2026, 11, 1), months, None, None, None, None));

        error.ParamName.ShouldBe("months");
    }

    [Fact]
    public void ANullListIsRefused()
    {
        Should.Throw<ArgumentNullException>(() => ChartMonths.Build(new DateOnly(2026, 11, 1), 1, null!, None, None, None));
        Should.Throw<ArgumentNullException>(() => ChartMonths.Build(new DateOnly(2026, 11, 1), 1, None, null!, None, None));
        Should.Throw<ArgumentNullException>(() => ChartMonths.Build(new DateOnly(2026, 11, 1), 1, None, None, null!, None));
        Should.Throw<ArgumentNullException>(() => ChartMonths.Build(new DateOnly(2026, 11, 1), 1, None, None, None, null!));
    }
}
