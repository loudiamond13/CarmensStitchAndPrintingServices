using Csps.Domain.Time;

namespace Csps.Domain.UnitTests.Time;

/// <summary>
/// FND-08, D-02, D-03: business day, month and year boundaries in Asia/Manila (UTC+08, no DST), plus the DST rules
/// for a zone a Manager might store later.
/// </summary>
public sealed class BusinessClockTests
{
    private static readonly TimeZoneInfo Manila = TimeZoneResolver.Resolve(TimeZoneResolver.DefaultIana).Zone;

    // UTC-03 with one hour of DST that starts at local midnight on Nov 1 (00:00 -> 01:00, so midnight does not
    // exist) and ends at 01:00 daylight time on Feb 15 (01:00 -> 00:00, so midnight happens twice).
    private static readonly TimeZoneInfo MidnightDstZone = TimeZoneInfo.CreateCustomTimeZone(
        "Test/MidnightDst",
        TimeSpan.FromHours(-3),
        "Midnight DST test zone",
        "Standard",
        "Daylight",
        [
            TimeZoneInfo.AdjustmentRule.CreateAdjustmentRule(
                new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Unspecified),
                new DateTime(2099, 12, 31, 0, 0, 0, DateTimeKind.Unspecified),
                TimeSpan.FromHours(1),
                TimeZoneInfo.TransitionTime.CreateFixedDateRule(new DateTime(1, 1, 1, 0, 0, 0, DateTimeKind.Unspecified), 11, 1),
                TimeZoneInfo.TransitionTime.CreateFixedDateRule(new DateTime(1, 1, 1, 1, 0, 0, DateTimeKind.Unspecified), 2, 15)),
        ]);

    [Fact]
    public void TodayAtManilaMidnightBoundary()
    {
        var lastSecond = ManilaClockAt("2026-10-06T15:59:59Z");
        var midnight = ManilaClockAt("2026-10-06T16:00:00Z");

        lastSecond.Today.ShouldBe(new DateOnly(2026, 10, 6));
        midnight.Today.ShouldBe(new DateOnly(2026, 10, 7));
        midnight.LocalNow.ShouldBe(new DateTimeOffset(2026, 10, 7, 0, 0, 0, TimeSpan.FromHours(8)));
    }

    [Fact]
    public void MonthStartsAtLocalMidnight()
    {
        var clock = ManilaClockAt("2026-10-15T04:00:00Z");

        var (startUtc, endUtcExclusive) = clock.MonthUtcRange(new DateOnly(2026, 10, 15));

        startUtc.ShouldBe(Utc("2026-09-30T16:00:00Z"));
        endUtcExclusive.ShouldBe(Utc("2026-10-31T16:00:00Z"));
        startUtc.Offset.ShouldBe(TimeSpan.Zero);
    }

    [Fact]
    public void SevenAmOnTheFirstIsInTheNewMonth()
    {
        // Nov 1, 07:00 in Manila, but still Oct 31 in UTC.
        var clock = ManilaClockAt("2026-10-31T23:00:00Z");

        clock.Today.ShouldBe(new DateOnly(2026, 11, 1));
        var (startUtc, endUtcExclusive) = clock.MonthUtcRange(new DateOnly(2026, 11, 1));
        clock.UtcNow.ShouldBeGreaterThanOrEqualTo(startUtc);
        clock.UtcNow.ShouldBeLessThan(endUtcExclusive);
    }

    [Fact]
    public void YearRollsOverInManila()
    {
        var lastSecond = ManilaClockAt("2026-12-31T15:59:59Z");
        var newYear = ManilaClockAt("2026-12-31T16:00:00Z");

        lastSecond.Year.ShouldBe(2026);
        newYear.Year.ShouldBe(2027);
        var (startUtc, endUtcExclusive) = newYear.YearUtcRange(2027);
        startUtc.ShouldBe(Utc("2026-12-31T16:00:00Z"));
        endUtcExclusive.ShouldBe(Utc("2027-12-31T16:00:00Z"));
    }

    [Fact]
    public void MonthOfReturnsFirstAndLastDay()
    {
        BusinessClock.MonthOf(new DateOnly(2026, 2, 10)).ShouldBe((new DateOnly(2026, 2, 1), new DateOnly(2026, 2, 28)));
        BusinessClock.MonthOf(new DateOnly(2028, 2, 10)).ShouldBe((new DateOnly(2028, 2, 1), new DateOnly(2028, 2, 29)));
        BusinessClock.MonthOf(new DateOnly(2026, 12, 31)).ShouldBe((new DateOnly(2026, 12, 1), new DateOnly(2026, 12, 31)));
    }

    [Fact]
    public void UtcRangeIsExclusiveAtEnd()
    {
        var clock = ManilaClockAt("2026-10-07T04:00:00Z");

        var (startUtc, endUtcExclusive) = clock.UtcRange(new DateOnly(2026, 10, 7), new DateOnly(2026, 10, 7));

        (endUtcExclusive - startUtc).ShouldBe(TimeSpan.FromHours(24));
        endUtcExclusive.ShouldBe(Utc("2026-10-07T16:00:00Z"));
    }

    [Fact]
    public void UtcRangeRejectsReversedDates()
    {
        var clock = ManilaClockAt("2026-10-07T04:00:00Z");

        var error = Should.Throw<ArgumentOutOfRangeException>(() => clock.UtcRange(new DateOnly(2026, 10, 8), new DateOnly(2026, 10, 7)));

        error.ParamName.ShouldBe("toInclusive");
    }

    [Fact]
    public void SkipsInvalidLocalMidnightInDstZone()
    {
        var clock = new BusinessClock(MidnightDstZone, ZoneSource.Stored, Utc("2026-11-01T12:00:00Z"));

        var (startUtc, endUtcExclusive) = clock.UtcRange(new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 1));

        // Midnight never happens on Nov 1; the day starts at 01:00 daylight time (UTC-02).
        startUtc.ShouldBe(Utc("2026-11-01T03:00:00Z"));
        endUtcExclusive.ShouldBe(Utc("2026-11-02T02:00:00Z"));
        (endUtcExclusive - startUtc).ShouldBe(TimeSpan.FromHours(23));
    }

    [Fact]
    public void AmbiguousLocalMidnightStartsAtFirstOccurrence()
    {
        var clock = new BusinessClock(MidnightDstZone, ZoneSource.Stored, Utc("2027-02-15T12:00:00Z"));

        var (startUtc, endUtcExclusive) = clock.UtcRange(new DateOnly(2027, 2, 15), new DateOnly(2027, 2, 15));

        // Midnight happens at UTC-02 and again at UTC-03; the day starts at the first one and lasts 25 hours.
        startUtc.ShouldBe(Utc("2027-02-15T02:00:00Z"));
        endUtcExclusive.ShouldBe(Utc("2027-02-16T03:00:00Z"));
        (endUtcExclusive - startUtc).ShouldBe(TimeSpan.FromHours(25));
    }

    private static BusinessClock ManilaClockAt(string utc) => new(Manila, ZoneSource.Stored, Utc(utc));

    private static DateTimeOffset Utc(string value) =>
        DateTimeOffset.Parse(value, System.Globalization.CultureInfo.InvariantCulture);
}
