using Csps.Domain.Common;
using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

/// <summary>
/// CONT-01, D-21, UI-SPEC validation: one weekday's hours. A day is open with both times or closed with neither, closing is after
/// opening, and times sit on the half hour from 5:00 AM to 11:30 PM. A refused save changes nothing.
/// </summary>
public sealed class OpeningHoursTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 0, 0, 0, TimeSpan.Zero);

    private static OpeningHours Monday() => OpeningHours.Closed(1, Now);

    [Fact]
    public void AClosedDayHasNoTimesAndNoStamps()
    {
        var day = OpeningHours.Closed(3, Now);

        day.DayOfWeek.ShouldBe(3);
        day.OpensAt.ShouldBeNull();
        day.ClosesAt.ShouldBeNull();
        day.CreatedAtUtc.ShouldBe(Now);
        day.CreatedById.ShouldBeNull();
        day.UpdatedAtUtc.ShouldBeNull();
        day.UpdatedById.ShouldBeNull();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(8)]
    public void ADayOutsideOneToSevenCannotBeCreated(int dayOfWeek) =>
        Should.Throw<ArgumentOutOfRangeException>(() => OpeningHours.Closed(dayOfWeek, Now));

    [Fact]
    public void SettingBothTimesOpensTheDayAndReportsWhatChanged()
    {
        var day = Monday();

        var result = day.SetHours(new TimeOnly(9, 0), new TimeOnly(18, 0));

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(new OpeningHoursChange(1, null, null, new TimeOnly(9, 0), new TimeOnly(18, 0)));
        day.OpensAt.ShouldBe(new TimeOnly(9, 0));
        day.ClosesAt.ShouldBe(new TimeOnly(18, 0));
    }

    [Fact]
    public void TheSameHoursAreNoChange()
    {
        var day = Monday();
        day.SetHours(new TimeOnly(9, 0), new TimeOnly(18, 0));

        var result = day.SetHours(new TimeOnly(9, 0), new TimeOnly(18, 0));

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBeNull();
    }

    [Fact]
    public void AClosedDayKeptClosedIsNoChange()
    {
        var result = Monday().SetHours(null, null);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBeNull();
    }

    [Fact]
    public void ChangingOnlyTheClosingTimeIsAChange()
    {
        var day = Monday();
        day.SetHours(new TimeOnly(9, 0), new TimeOnly(18, 0));

        var result = day.SetHours(new TimeOnly(9, 0), new TimeOnly(17, 0));

        result.Value.ShouldBe(new OpeningHoursChange(1, new TimeOnly(9, 0), new TimeOnly(18, 0), new TimeOnly(9, 0), new TimeOnly(17, 0)));
    }

    [Fact]
    public void ChangingOnlyTheOpeningTimeIsAChange()
    {
        var day = Monday();
        day.SetHours(new TimeOnly(9, 0), new TimeOnly(18, 0));

        var result = day.SetHours(new TimeOnly(10, 0), new TimeOnly(18, 0));

        result.Value.ShouldBe(new OpeningHoursChange(1, new TimeOnly(9, 0), new TimeOnly(18, 0), new TimeOnly(10, 0), new TimeOnly(18, 0)));
    }

    [Fact]
    public void SettingNoTimesClosesAnOpenDayAndReportsTheOldTimes()
    {
        var day = Monday();
        day.SetHours(new TimeOnly(9, 0), new TimeOnly(18, 0));

        var result = day.SetHours(null, null);

        result.Value.ShouldBe(new OpeningHoursChange(1, new TimeOnly(9, 0), new TimeOnly(18, 0), null, null));
        day.OpensAt.ShouldBeNull();
        day.ClosesAt.ShouldBeNull();
    }

    [Fact]
    public void ADayWithNoOpeningTimeIsRefused() =>
        Fields(Monday().SetHours(null, new TimeOnly(18, 0))).ShouldBe([("opensAt", "Choose the opening time.")]);

    [Fact]
    public void ADayWithNoClosingTimeIsRefused() =>
        Fields(Monday().SetHours(new TimeOnly(9, 0), null)).ShouldBe([("closesAt", "Choose the closing time.")]);

    [Theory]
    [InlineData(18, 0, 9, 0)]
    [InlineData(9, 0, 9, 0)]
    [InlineData(17, 30, 17, 0)]
    public void ClosingAtOrBeforeOpeningIsRefusedOnTheClosingTime(int openHour, int openMinute, int closeHour, int closeMinute) =>
        Fields(Monday().SetHours(new TimeOnly(openHour, openMinute), new TimeOnly(closeHour, closeMinute)))
            .ShouldBe([("closesAt", "Closing time must be after opening time.")]);

    [Theory]
    [InlineData(9, 15)]
    [InlineData(9, 45)]
    [InlineData(4, 30)]
    [InlineData(4, 0)]
    [InlineData(23, 30)]
    public void AnOpeningTimeOffTheHalfHourOrOutsideFiveToElevenThirtyIsRefusedUnlessItFits(int hour, int minute)
    {
        var result = Monday().SetHours(new TimeOnly(hour, minute), new TimeOnly(23, 30));

        // 23:30 as an opening time has nothing after it but is itself a legal time, so only the ordering rule can refuse it.
        if (hour == 23)
        {
            Fields(result).ShouldBe([("closesAt", "Closing time must be after opening time.")]);
        }
        else
        {
            Fields(result).ShouldBe([("opensAt", "Choose a time on the hour or half hour, from 5:00 AM to 11:30 PM.")]);
        }
    }

    [Theory]
    [InlineData(17, 45)]
    [InlineData(23, 45)]
    [InlineData(0, 0)]
    public void AClosingTimeOffTheHalfHourOrAfterElevenThirtyIsRefusedOnTheClosingTime(int hour, int minute) =>
        Fields(Monday().SetHours(new TimeOnly(5, 0), new TimeOnly(hour, minute)))
            .ShouldContain(("closesAt", "Choose a time on the hour or half hour, from 5:00 AM to 11:30 PM."));

    [Fact]
    public void TheWholeRangeFromFiveToElevenThirtyIsAllowed()
    {
        var day = Monday();

        var result = day.SetHours(new TimeOnly(5, 0), new TimeOnly(23, 30));

        result.IsSuccess.ShouldBeTrue();
        day.OpensAt.ShouldBe(new TimeOnly(5, 0));
        day.ClosesAt.ShouldBe(new TimeOnly(23, 30));
    }

    [Fact]
    public void BothBrokenTimesAreReportedTogether() =>
        Fields(Monday().SetHours(new TimeOnly(9, 15), new TimeOnly(17, 45)))
            .ShouldBe(
            [
                ("closesAt", "Choose a time on the hour or half hour, from 5:00 AM to 11:30 PM."),
                ("opensAt", "Choose a time on the hour or half hour, from 5:00 AM to 11:30 PM."),
            ]);

    [Fact]
    public void ARefusedSaveChangesNothing()
    {
        var day = Monday();
        day.SetHours(new TimeOnly(9, 0), new TimeOnly(18, 0));

        day.SetHours(new TimeOnly(18, 0), new TimeOnly(9, 0)).IsFailure.ShouldBeTrue();

        day.OpensAt.ShouldBe(new TimeOnly(9, 0));
        day.ClosesAt.ShouldBe(new TimeOnly(18, 0));
    }

    private static List<(string Field, string Message)> Fields(Result<OpeningHoursChange?> result)
    {
        result.IsFailure.ShouldBeTrue("the hours should have been refused");
        return [.. result.Error.FieldErrors!.OrderBy(pair => pair.Key, StringComparer.Ordinal).SelectMany(pair => pair.Value.Select(message => (pair.Key, message)))];
    }
}
