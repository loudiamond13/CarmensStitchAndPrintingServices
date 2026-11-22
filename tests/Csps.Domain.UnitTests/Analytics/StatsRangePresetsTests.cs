using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

/// <summary>ANL-08 (D-24): the presets resolve to the same dates the web client shows.</summary>
public sealed class StatsRangePresetsTests
{
    private static readonly DateOnly Today = new(2026, 11, 15);

    [Theory]
    [InlineData("last-30-days", 2026, 10, 17, 2026, 11, 15)]
    [InlineData("last-7-days", 2026, 11, 9, 2026, 11, 15)]
    [InlineData("this-month", 2026, 11, 1, 2026, 11, 15)]
    [InlineData("last-month", 2026, 10, 1, 2026, 10, 31)]
    [InlineData("this-year", 2026, 1, 1, 2026, 11, 15)]
    public void EachPresetResolvesAgainstTheBusinessToday(string name, int fromYear, int fromMonth, int fromDay, int toYear, int toMonth, int toDay)
    {
        StatsRangePresets.Resolve(name, Today).ShouldBe((new DateOnly(fromYear, fromMonth, fromDay), new DateOnly(toYear, toMonth, toDay)));
    }

    [Fact]
    public void LastMonthOnAMonthEndGivesTheWholeShorterMonth()
    {
        StatsRangePresets.Resolve("last-month", new DateOnly(2026, 3, 31)).ShouldBe((new DateOnly(2026, 2, 1), new DateOnly(2026, 2, 28)));
    }

    [Fact]
    public void LastMonthInJanuaryIsDecember()
    {
        StatsRangePresets.Resolve("last-month", new DateOnly(2027, 1, 10)).ShouldBe((new DateOnly(2026, 12, 1), new DateOnly(2026, 12, 31)));
    }

    [Fact]
    public void LastSevenDaysCrossesTheYearEnd()
    {
        StatsRangePresets.Resolve("last-7-days", new DateOnly(2027, 1, 3)).ShouldBe((new DateOnly(2026, 12, 28), new DateOnly(2027, 1, 3)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("bogus")]
    [InlineData("custom")]
    public void AnUnknownOrMissingNameResolvesToLastThirtyDays(string? name)
    {
        StatsRangePresets.Resolve(name, Today).ShouldBe((new DateOnly(2026, 10, 17), Today));
    }

    [Fact]
    public void TheNamesListsTheFivePresetsAndTheDefaultIsLastThirtyDays()
    {
        StatsRangePresets.Names.ShouldBe(["last-7-days", "last-30-days", "this-month", "last-month", "this-year"]);
        StatsRangePresets.Default.ShouldBe("last-30-days");
        StatsRangePresets.Custom.ShouldBe("custom");
    }
}
