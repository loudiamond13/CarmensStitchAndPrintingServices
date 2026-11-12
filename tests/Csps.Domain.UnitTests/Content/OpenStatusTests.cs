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
