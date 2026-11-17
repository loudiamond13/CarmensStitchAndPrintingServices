using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

/// <summary>ANL-08, ANL-09 (D-03 to D-05, D-07): the retention periods and cut dates.</summary>
public sealed class AnalyticsRetentionTests
{
    [Fact]
    public void TheRetentionConstantsHoldTheOwnerRulings()
    {
        AnalyticsRetention.RawMonths.ShouldBe(13);
        AnalyticsRetention.ConsentMonths.ShouldBe(13);
        AnalyticsRetention.DailyYears.ShouldBe(3);
        AnalyticsRetention.ConsentLifetimeMonths.ShouldBe(12);
        AnalyticsRetention.SessionMinutes.ShouldBe(30);
        AnalyticsRetention.SaltDays.ShouldBe(2);
    }

    [Theory]
    [InlineData(2026, 11, 15, 2025, 10, 15)]
    [InlineData(2027, 3, 31, 2026, 2, 28)]
    [InlineData(2028, 3, 31, 2027, 2, 28)]
    public void TheRawCutIsThirteenMonthsBack(int year, int month, int day, int cutYear, int cutMonth, int cutDay)
    {
        AnalyticsRetention.RawCut(new DateOnly(year, month, day)).ShouldBe(new DateOnly(cutYear, cutMonth, cutDay));
    }

    [Theory]
    [InlineData(2026, 11, 15, 2023, 11, 15)]
    [InlineData(2028, 2, 29, 2025, 2, 28)]
    public void TheDailyFloorIsThreeYearsBack(int year, int month, int day, int floorYear, int floorMonth, int floorDay)
    {
        AnalyticsRetention.DailyFloor(new DateOnly(year, month, day)).ShouldBe(new DateOnly(floorYear, floorMonth, floorDay));
    }

    [Fact]
    public void ConsentRecordsAreKeptThirteenMonths()
    {
        var now = new DateTimeOffset(2026, 11, 15, 0, 0, 0, TimeSpan.Zero);

        AnalyticsRetention.ConsentPurgeBefore(now).ShouldBe(new DateTimeOffset(2025, 10, 15, 0, 0, 0, TimeSpan.Zero));
    }
}
