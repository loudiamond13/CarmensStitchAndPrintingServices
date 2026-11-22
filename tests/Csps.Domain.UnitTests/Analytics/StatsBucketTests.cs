using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

/// <summary>ANL-08: a range of 62 days or fewer is drawn per day, longer per month.</summary>
public sealed class StatsBucketTests
{
    [Fact]
    public void TheDayLimitIsSixtyTwo()
    {
        StatsBucket.MaxDayBuckets.ShouldBe(62);
    }

    [Fact]
    public void AOneDayRangeIsPerDay()
    {
        StatsBucket.For(new DateOnly(2026, 11, 15), new DateOnly(2026, 11, 15)).ShouldBe(StatsBucketKind.Day);
    }

    [Fact]
    public void AThirtyDayRangeIsPerDay()
    {
        StatsBucket.For(new DateOnly(2026, 10, 17), new DateOnly(2026, 11, 15)).ShouldBe(StatsBucketKind.Day);
    }

    [Fact]
    public void ASixtyTwoDayRangeIsPerDay()
    {
        var from = new DateOnly(2026, 9, 1);

        StatsBucket.For(from, from.AddDays(61)).ShouldBe(StatsBucketKind.Day);
    }

    [Fact]
    public void ASixtyThreeDayRangeIsPerMonth()
    {
        var from = new DateOnly(2026, 9, 1);

        StatsBucket.For(from, from.AddDays(62)).ShouldBe(StatsBucketKind.Month);
    }

    [Fact]
    public void ThisYearSoFarIsPerMonth()
    {
        StatsBucket.For(new DateOnly(2026, 1, 1), new DateOnly(2026, 11, 15)).ShouldBe(StatsBucketKind.Month);
    }
}
