using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Domain.Content;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Content;

/// <summary>
/// CONT-01, PUB-05, D-22: the hours and open-status answers are facts in "HH:mm" and 1 to 7 weekday numbers, the week version is the seven
/// row versions joined, and the open status is worked out in the business zone from the cached hours.
/// </summary>
public sealed class OpeningHoursReadModelTests
{
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila");

    [Fact]
    public void TheWeekVersionIsTheSevenRowVersionsInOrderAndReadsBack()
    {
        byte[][] versions = [.. Enumerable.Range(1, 7).Select(day => new byte[] { 0, 0, 0, 0, 0, 0, 0, (byte)day })];

        var text = OpeningHoursVersion.ToText(versions);

        OpeningHoursVersion.TryParse(text, out var bytes).ShouldBeTrue();
        bytes.Length.ShouldBe(56);
        bytes[7].ShouldBe((byte)1);
        bytes[55].ShouldBe((byte)7);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("not base64!")]
    [InlineData("AAAAAAAAB9E=")]
    public void AnythingButFiftySixBytesIsNotAWeekVersion(string? text)
    {
        OpeningHoursVersion.TryParse(text, out var bytes).ShouldBeFalse();
        bytes.ShouldBeEmpty();
    }

    [Fact]
    public void AWeekViewBecomesSevenDaysWithTheVersionAndTheLastChanger()
    {
        var changed = new DateTimeOffset(2026, 11, 12, 8, 0, 0, TimeSpan.Zero);
        var view = new OpeningHoursView(
            [.. Enumerable.Range(1, 7).Select(day => new OpeningHoursRowView(day, day == 1 ? new TimeOnly(9, 0) : null, day == 1 ? new TimeOnly(18, 30) : null, new byte[8]))],
            "Paolo Reyes",
            changed);

        var dto = OpeningHoursDto.From(view);

        dto.Days[0].ShouldBe(new DayHoursDto(1, "09:00", "18:30"));
        dto.Days[1].ShouldBe(new DayHoursDto(2, null, null));
        dto.Version.ShouldBe(Convert.ToBase64String(new byte[56]));
        dto.UpdatedByName.ShouldBe("Paolo Reyes");
        dto.UpdatedAtUtc.ShouldBe(changed);
    }

    [Fact]
    public void ADayConvertsBetweenTheApiNumberAndTheDomainDay()
    {
        DayHoursDto.From(new DayHours(DayOfWeek.Sunday, null, null)).Day.ShouldBe(7);
        DayHoursDto.From(new DayHours(DayOfWeek.Monday, new TimeOnly(9, 0), new TimeOnly(18, 0))).ShouldBe(new DayHoursDto(1, "09:00", "18:00"));
        new DayHoursDto(7, "10:00", "16:00").ToDomain().ShouldBe(new DayHours(DayOfWeek.Sunday, new TimeOnly(10, 0), new TimeOnly(16, 0)));
        new DayHoursDto(3, "nonsense", null).ToDomain().ShouldBe(new DayHours(DayOfWeek.Wednesday, null, null));
        WeekDay.ToNumber(DayOfWeek.Saturday).ShouldBe(6);
        WeekDay.FromNumber(6).ShouldBe(DayOfWeek.Saturday);
    }

    [Fact]
    public void ANullViewOrDayIsAProgrammingError()
    {
        Should.Throw<ArgumentNullException>(() => OpeningHoursDto.From(null!));
        Should.Throw<ArgumentNullException>(() => DayHoursDto.From(null!));
        Should.Throw<ArgumentNullException>(() => OpenStatusDto.From(null!));
        Should.Throw<ArgumentNullException>(() => OpeningHoursAuditDetail.Changed(null!));
        Should.Throw<ArgumentNullException>(() => OpeningHoursVersion.ToText(null!));
    }

    [Fact]
    public void TheAuditDetailListsDaysMondayFirstWithClosedForNoTimes()
    {
        var detail = OpeningHoursAuditDetail.Changed(
        [
            new OpeningHoursChange(7, new TimeOnly(10, 0), new TimeOnly(16, 0), null, null),
            new OpeningHoursChange(1, null, null, new TimeOnly(9, 0), new TimeOnly(18, 0)),
        ]);

        detail.ShouldBe("monday=closed>09:00-18:00;sunday=10:00-16:00>closed");
    }

    [Fact]
    public async Task OpenNowGivesTheClosingTimeAndNoNextOpening()
    {
        var handler = Handler(WeekMondaySaturday(), new DateTimeOffset(2026, 11, 16, 2, 0, 0, TimeSpan.Zero));

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.ShouldBe(new OpenStatusDto(true, "18:00", false, null, null));
    }

    [Fact]
    public async Task ClosedAfterClosingGivesTomorrowAsTheNextOpening()
    {
        var handler = Handler(WeekMondaySaturday(), new DateTimeOffset(2026, 11, 16, 10, 0, 0, TimeSpan.Zero));

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.IsOpen.ShouldBeFalse();
        result.Value.ClosesAt.ShouldBeNull();
        result.Value.NextOpening.ShouldBe(new NextOpeningDto("2026-11-17", 2, "09:00", "tomorrow"));
    }

    [Fact]
    public async Task ClosedBeforeOpeningGivesTodayAndAfterSaturdayClosingTheNextWeekdayIsMonday()
    {
        var early = await Handler(WeekMondaySaturday(), new DateTimeOffset(2026, 11, 15, 22, 0, 0, TimeSpan.Zero)).HandleAsync(TestContext.Current.CancellationToken);
        var saturdayNight = await Handler(WeekMondaySaturday(), new DateTimeOffset(2026, 11, 14, 11, 0, 0, TimeSpan.Zero)).HandleAsync(TestContext.Current.CancellationToken);

        early.Value.NextOpening.ShouldBe(new NextOpeningDto("2026-11-16", 1, "09:00", "today"));
        saturdayNight.Value.NextOpening.ShouldBe(new NextOpeningDto("2026-11-16", 1, "09:00", "weekday"));
    }

    [Fact]
    public async Task AnEmptyWeekIsClosedWithNothingNext()
    {
        var handler = Handler(Enumerable.Range(1, 7).Select(day => new DayHoursDto(day, null, null)).ToList(), new DateTimeOffset(2026, 11, 16, 2, 0, 0, TimeSpan.Zero));

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.ShouldBe(new OpenStatusDto(false, null, false, null, null));
    }

    [Fact]
    public async Task TheHoursHandlerReturnsTheStoredWeek()
    {
        var store = Substitute.For<ISiteContentStore>();
        store.GetHoursViewAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(new OpeningHoursView([.. Enumerable.Range(1, 7).Select(day => new OpeningHoursRowView(day, null, null, new byte[8]))], null, null)));

        var result = await new GetOpeningHoursHandler(store).HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Days.Count.ShouldBe(7);
    }

    private static List<DayHoursDto> WeekMondaySaturday() =>
        [.. Enumerable.Range(1, 7).Select(day => day <= 6 ? new DayHoursDto(day, "09:00", "18:00") : new DayHoursDto(day, null, null))];

    private static GetOpenStatusHandler Handler(List<DayHoursDto> week, DateTimeOffset utcNow)
    {
        var site = new PublicSiteDto(
            "Sample Shop", "Sample tagline", null, null, new PublicAddressDto(null, null, null, null), [], null, null, null, null, null, null, 2026, week);
        var reader = Substitute.For<IPublicContentReader>();
        var calendar = Substitute.For<IBusinessCalendar>();
#pragma warning disable CA2012 // NSubstitute only records the call here; the arranged ValueTask is consumed once, by the handler.
        reader.GetSiteAsync(Arg.Any<CancellationToken>())
            .Returns(_ => ValueTask.FromResult(new PublicSiteSnapshot(site, new PublicJsonSnapshot("{}", "\"x\"", utcNow))));
        calendar.GetClockAsync(Arg.Any<CancellationToken>()).Returns(_ => ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, utcNow)));
#pragma warning restore CA2012
        return new GetOpenStatusHandler(reader, calendar);
    }
}
