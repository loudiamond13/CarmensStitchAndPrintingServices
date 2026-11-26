using Csps.Domain.QuoteRequests;
using Csps.Domain.Time;

namespace Csps.Domain.UnitTests.QuoteRequests;

/// <summary>INQ-07, Phase 12 D-02, D-07: a quote request that never became an order is kept for 6 calendar months in business time.</summary>
public sealed class QuoteRequestRetentionTests
{
    private static readonly TimeZoneInfo Manila = TimeZoneResolver.Resolve(TimeZoneResolver.DefaultIana).Zone;

    [Fact]
    public void TheRetentionIsSixMonths()
    {
        QuoteRequestRetention.Months.ShouldBe(6);
    }

    [Fact]
    public void TheCutIsTheStartOfTheBusinessDaySixMonthsBack()
    {
        var cut = QuoteRequestRetention.PurgeBefore(new DateOnly(2026, 11, 21), Manila);

        // 2026-05-21 00:00 in Manila (UTC+08) is 2026-05-20 16:00 UTC.
        cut.ShouldBe(new DateTimeOffset(2026, 5, 20, 16, 0, 0, TimeSpan.Zero));
        cut.Offset.ShouldBe(TimeSpan.Zero);
    }

    [Theory]
    [InlineData(2026, 8, 31, 2026, 2, 28)]
    [InlineData(2028, 8, 31, 2028, 2, 29)]
    [InlineData(2027, 3, 31, 2026, 9, 30)]
    [InlineData(2027, 1, 1, 2026, 7, 1)]
    public void AMonthEndDayIsClampedToTheShorterMonth(int year, int month, int day, int cutYear, int cutMonth, int cutDay)
    {
        var cut = QuoteRequestRetention.PurgeBefore(new DateOnly(year, month, day), Manila);

        var expected = new DateTimeOffset(new DateTime(cutYear, cutMonth, cutDay, 0, 0, 0, DateTimeKind.Unspecified), TimeSpan.FromHours(8)).ToUniversalTime();
        cut.ShouldBe(expected);
    }
}
