using Csps.Domain.Content;
using Csps.Domain.Time;

namespace Csps.Domain.UnitTests.Content;

/// <summary>
/// PUB-05, D-21, D-22, CONT-04: the open or closed rule in Asia/Manila. Monday 2026-11-09 is the base day.
/// </summary>
public sealed class OpenStatusTests
{
    private static readonly TimeZoneInfo Manila = TimeZoneResolver.Resolve(TimeZoneResolver.DefaultIana).Zone;

    private static readonly TimeOnly Nine = new(9, 0);
    private static readonly TimeOnly SixPm = new(18, 0);

    private static readonly IReadOnlyList<ClosureSpan> NoClosures = [];

    [Fact]
    public void TenAmOnAMondayIsOpenUntilSixPm()
    {
        var status = OpenStatus.Compute(ManilaClockAt("2026-11-09T10:00:00"), NineToSixMondayToSaturday(), NoClosures);

        status.IsOpen.ShouldBeTrue();
        status.ClosesAt.ShouldBe(SixPm);
        status.ClosedToday.ShouldBeFalse();
        status.TodayClosureNote.ShouldBeNull();
        status.NextOpening.ShouldBeNull();
    }

    [Fact]
    public void TheSameInstantInAnotherClockZoneGivesThatZonesAnswer()
    {
        // 10:00 Monday in Manila is 18:00 Sunday at UTC-08, where Sunday is a closed day.
        var instant = DateTimeOffset.Parse("2026-11-09T10:00:00+08:00", System.Globalization.CultureInfo.InvariantCulture).ToUniversalTime();
        var minusEight = TimeZoneInfo.CreateCustomTimeZone("Test/MinusEight", TimeSpan.FromHours(-8), "Minus eight", "Minus eight");

        var inManila = OpenStatus.Compute(new BusinessClock(Manila, ZoneSource.Stored, instant), NineToSixMondayToSaturday(), NoClosures);
        var elsewhere = OpenStatus.Compute(new BusinessClock(minusEight, ZoneSource.Stored, instant), NineToSixMondayToSaturday(), NoClosures);

        inManila.IsOpen.ShouldBeTrue();
        elsewhere.IsOpen.ShouldBeFalse();
    }

    [Fact]
    public void EightFiftyNineIsClosedAndOpensToday()
    {
        var status = OpenStatus.Compute(ManilaClockAt("2026-11-09T08:59:00"), NineToSixMondayToSaturday(), NoClosures);

        status.IsOpen.ShouldBeFalse();
        status.ClosesAt.ShouldBeNull();
        status.ClosedToday.ShouldBeFalse();
        status.NextOpening.ShouldBe(new NextOpening(new DateOnly(2026, 11, 9), DayOfWeek.Monday, Nine, NextOpeningWhen.Today));
    }

    [Fact]
    public void NineAmIsOpen()
    {
        var status = OpenStatus.Compute(ManilaClockAt("2026-11-09T09:00:00"), NineToSixMondayToSaturday(), NoClosures);

        status.IsOpen.ShouldBeTrue();
        status.ClosesAt.ShouldBe(SixPm);
        status.NextOpening.ShouldBeNull();
    }

    [Fact]
    public void FiveFiftyNinePmIsOpen()
    {
        var status = OpenStatus.Compute(ManilaClockAt("2026-11-09T17:59:59"), NineToSixMondayToSaturday(), NoClosures);

        status.IsOpen.ShouldBeTrue();
        status.ClosesAt.ShouldBe(SixPm);
    }

    [Fact]
    public void SixPmIsClosedAndOpensTomorrow()
    {
        var status = OpenStatus.Compute(ManilaClockAt("2026-11-09T18:00:00"), NineToSixMondayToSaturday(), NoClosures);

        status.IsOpen.ShouldBeFalse();
        status.ClosesAt.ShouldBeNull();
        status.NextOpening.ShouldBe(new NextOpening(new DateOnly(2026, 11, 10), DayOfWeek.Tuesday, Nine, NextOpeningWhen.Tomorrow));
    }

    [Fact]
    public void SaturdayEveningWithSundayClosedOpensOnMondayAsAWeekday()
    {
        var status = OpenStatus.Compute(ManilaClockAt("2026-11-14T19:00:00"), NineToSixMondayToSaturday(), NoClosures);

        status.IsOpen.ShouldBeFalse();
        status.ClosedToday.ShouldBeFalse();
        status.NextOpening.ShouldBe(new NextOpening(new DateOnly(2026, 11, 16), DayOfWeek.Monday, Nine, NextOpeningWhen.Weekday));
    }

    [Fact]
    public void SundayMorningOpensTomorrow()
    {
        var status = OpenStatus.Compute(ManilaClockAt("2026-11-15T07:00:00"), NineToSixMondayToSaturday(), NoClosures);

        status.IsOpen.ShouldBeFalse();
        status.NextOpening.ShouldBe(new NextOpening(new DateOnly(2026, 11, 16), DayOfWeek.Monday, Nine, NextOpeningWhen.Tomorrow));
    }

    [Fact]
    public void ManilaDateNotTheUtcDateDecidesToday()
    {
        // 01:00 Monday in Manila is still Sunday in UTC.
        var status = OpenStatus.Compute(ManilaClockAt("2026-11-09T01:00:00"), NineToSixMondayToSaturday(), NoClosures);

        status.IsOpen.ShouldBeFalse();
        status.NextOpening.ShouldBe(new NextOpening(new DateOnly(2026, 11, 9), DayOfWeek.Monday, Nine, NextOpeningWhen.Today));
    }

    [Fact]
    public void ClosureTodayClosesTheWholeDayWithItsNote()
    {
        var closures = new[] { new ClosureSpan(new DateOnly(2026, 11, 9), new DateOnly(2026, 11, 9), "Christmas") };

        var status = OpenStatus.Compute(ManilaClockAt("2026-11-09T10:00:00"), NineToSixMondayToSaturday(), closures);

        status.IsOpen.ShouldBeFalse();
        status.ClosesAt.ShouldBeNull();
        status.ClosedToday.ShouldBeTrue();
        status.TodayClosureNote.ShouldBe("Christmas");
        status.NextOpening.ShouldBe(new NextOpening(new DateOnly(2026, 11, 10), DayOfWeek.Tuesday, Nine, NextOpeningWhen.Tomorrow));
    }

    [Fact]
    public void ClosureTodayWithNoNoteHasANullNote()
    {
        var closures = new[] { new ClosureSpan(new DateOnly(2026, 11, 9), new DateOnly(2026, 11, 9), null) };

        var status = OpenStatus.Compute(ManilaClockAt("2026-11-09T10:00:00"), NineToSixMondayToSaturday(), closures);

        status.ClosedToday.ShouldBeTrue();
        status.TodayClosureNote.ShouldBeNull();
    }

    [Fact]
    public void ClosureTodayBeforeOpeningDoesNotOfferTodayAsTheNextOpening()
    {
        var closures = new[] { new ClosureSpan(new DateOnly(2026, 11, 9), new DateOnly(2026, 11, 10), "Fiesta") };

        var status = OpenStatus.Compute(ManilaClockAt("2026-11-09T07:00:00"), NineToSixMondayToSaturday(), closures);

        status.ClosedToday.ShouldBeTrue();
        status.NextOpening.ShouldBe(new NextOpening(new DateOnly(2026, 11, 11), DayOfWeek.Wednesday, Nine, NextOpeningWhen.Weekday));
    }

    [Fact]
    public void ClosureStartingTomorrowSkipsEveryClosedDay()
    {
        var closures = new[] { new ClosureSpan(new DateOnly(2026, 11, 10), new DateOnly(2026, 11, 11), null) };

        var status = OpenStatus.Compute(ManilaClockAt("2026-11-09T18:30:00"), NineToSixMondayToSaturday(), closures);

        status.ClosedToday.ShouldBeFalse();
        status.NextOpening.ShouldBe(new NextOpening(new DateOnly(2026, 11, 12), DayOfWeek.Thursday, Nine, NextOpeningWhen.Weekday));
    }

    [Fact]
    public void ClosuresCoveringTheWholeLookAheadGiveNoNextOpening()
    {
        var closures = new[]
        {
            new ClosureSpan(new DateOnly(2026, 11, 9), new DateOnly(2026, 12, 9), "Renovation"),
            new ClosureSpan(new DateOnly(2026, 12, 10), new DateOnly(2027, 1, 9), "Renovation"),
        };

        var status = OpenStatus.Compute(ManilaClockAt("2026-11-09T10:00:00"), NineToSixMondayToSaturday(), closures);

        status.IsOpen.ShouldBeFalse();
        status.ClosedToday.ShouldBeTrue();
        status.NextOpening.ShouldBeNull();
    }

    [Fact]
    public void ClosuresThroughTheLastLookAheadDayLeaveNothingInRange()
    {
        var closures = new[]
        {
            new ClosureSpan(new DateOnly(2026, 11, 10), new DateOnly(2026, 12, 10), null),
            new ClosureSpan(new DateOnly(2026, 12, 11), new DateOnly(2026, 12, 17), null),
        };

        var status = OpenStatus.Compute(ManilaClockAt("2026-11-09T18:30:00"), NineToSixMondayToSaturday(), closures);

        status.NextOpening.ShouldBeNull();
    }

    [Fact]
    public void ClosuresEndingBeforeTheLastLookAheadDayFindThatDay()
    {
        var closures = new[]
        {
            new ClosureSpan(new DateOnly(2026, 11, 10), new DateOnly(2026, 12, 10), null),
            new ClosureSpan(new DateOnly(2026, 12, 11), new DateOnly(2026, 12, 16), null),
        };

        var status = OpenStatus.Compute(ManilaClockAt("2026-11-09T18:30:00"), NineToSixMondayToSaturday(), closures);

        status.NextOpening.ShouldBe(new NextOpening(new DateOnly(2026, 12, 17), DayOfWeek.Thursday, Nine, NextOpeningWhen.Weekday));
    }

    [Fact]
    public void ALongestClosureStillShowsTheReopeningDay()
    {
        var closures = new[] { new ClosureSpan(new DateOnly(2026, 12, 1), new DateOnly(2026, 12, 31), "Year-end break") };

        var status = OpenStatus.Compute(ManilaClockAt("2026-12-05T10:00:00"), NineToSixMondayToSaturday(), closures);

        status.IsOpen.ShouldBeFalse();
        status.ClosedToday.ShouldBeTrue();
        status.NextOpening.ShouldBe(new NextOpening(new DateOnly(2027, 1, 1), DayOfWeek.Friday, Nine, NextOpeningWhen.Weekday));
    }

    [Fact]
    public void LookAheadCoversTheLongestClosureAndAWeek()
    {
        OpenStatus.LookAheadDays.ShouldBe(ShopClosure.MaxSpanDays + 7);
    }

    [Fact]
    public void NoOpenDayInTheWeekGivesClosedWithNothingNext()
    {
        var week = Enum.GetValues<DayOfWeek>().Select(d => new DayHours(d, null, null)).ToList();

        var status = OpenStatus.Compute(ManilaClockAt("2026-11-09T10:00:00"), week, NoClosures);

        status.IsOpen.ShouldBeFalse();
        status.ClosesAt.ShouldBeNull();
        status.ClosedToday.ShouldBeFalse();
        status.NextOpening.ShouldBeNull();
    }

    [Fact]
    public void EmptyWeekCountsEveryDayAsClosed()
    {
        var status = OpenStatus.Compute(ManilaClockAt("2026-11-09T10:00:00"), [], NoClosures);

        status.IsOpen.ShouldBeFalse();
        status.NextOpening.ShouldBeNull();
    }

    [Fact]
    public void YearEndEveningWithNewYearsDayClosedOpensOnJanuarySecond()
    {
        var closures = new[] { new ClosureSpan(new DateOnly(2027, 1, 1), new DateOnly(2027, 1, 1), "New Year") };

        var status = OpenStatus.Compute(ManilaClockAt("2026-12-31T20:00:00"), NineToSixMondayToSaturday(), closures);

        status.ClosedToday.ShouldBeFalse();
        status.NextOpening.ShouldBe(new NextOpening(new DateOnly(2027, 1, 2), DayOfWeek.Saturday, Nine, NextOpeningWhen.Weekday));
    }

    [Fact]
    public void MonthEndEveningOpensOnTheFirstOfNextMonth()
    {
        var status = OpenStatus.Compute(ManilaClockAt("2027-01-31T20:00:00"), NineToSixMondayToSaturday(), NoClosures);

        status.NextOpening.ShouldBe(new NextOpening(new DateOnly(2027, 2, 1), DayOfWeek.Monday, Nine, NextOpeningWhen.Tomorrow));
    }

    [Fact]
    public void ClosureCoversBothEndDaysAndNothingOutside()
    {
        var closure = new ClosureSpan(new DateOnly(2026, 11, 10), new DateOnly(2026, 11, 12), null);

        closure.Covers(new DateOnly(2026, 11, 9)).ShouldBeFalse();
        closure.Covers(new DateOnly(2026, 11, 10)).ShouldBeTrue();
        closure.Covers(new DateOnly(2026, 11, 11)).ShouldBeTrue();
        closure.Covers(new DateOnly(2026, 11, 12)).ShouldBeTrue();
        closure.Covers(new DateOnly(2026, 11, 13)).ShouldBeFalse();
    }

    [Fact]
    public void ADayNeedsBothTimesToBeAnOpenDay()
    {
        new DayHours(DayOfWeek.Monday, Nine, SixPm).IsOpenDay.ShouldBeTrue();
        new DayHours(DayOfWeek.Monday, Nine, null).IsOpenDay.ShouldBeFalse();
        new DayHours(DayOfWeek.Monday, null, SixPm).IsOpenDay.ShouldBeFalse();
        new DayHours(DayOfWeek.Monday, null, null).IsOpenDay.ShouldBeFalse();
    }

    private static IReadOnlyList<DayHours> NineToSixMondayToSaturday() =>
    [
        new(DayOfWeek.Monday, Nine, SixPm),
        new(DayOfWeek.Tuesday, Nine, SixPm),
        new(DayOfWeek.Wednesday, Nine, SixPm),
        new(DayOfWeek.Thursday, Nine, SixPm),
        new(DayOfWeek.Friday, Nine, SixPm),
        new(DayOfWeek.Saturday, Nine, SixPm),
        new(DayOfWeek.Sunday, null, null),
    ];

    // A Manila wall-clock time such as "2026-11-09T10:00:00" turned into the UTC instant the clock carries.
    private static BusinessClock ManilaClockAt(string manilaLocal) => new(
        Manila,
        ZoneSource.Stored,
        DateTimeOffset.Parse(manilaLocal + "+08:00", System.Globalization.CultureInfo.InvariantCulture).ToUniversalTime());
}
