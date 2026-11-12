using Csps.Application.Common;
using Csps.Application.Content;

namespace Csps.Application.UnitTests.Content;

/// <summary>
/// CONT-01, OR-3, UI-SPEC validation: the weekly hours form refuses bad input on its own day and field with the approved message.
/// Times are "HH:mm" on the half hour from 05:00 to 23:30, and all seven days are sent once each.
/// </summary>
public sealed class UpdateOpeningHoursRequestValidatorTests
{
    private const string StepMessage = "Choose a time on the hour or half hour, from 5:00 AM to 11:30 PM.";

    // Fifty-six bytes: seven eight-byte row versions.
    private static readonly string Version = Convert.ToBase64String(new byte[OpeningHoursVersion.Length]);

    private static readonly UpdateOpeningHoursRequestValidator Validator = new();

    [Fact]
    public void AWeekOfMondayToSaturdayNineToSixPasses() => Fields(Request(Week(open: [1, 2, 3, 4, 5, 6]))).ShouldBeEmpty();

    [Fact]
    public void AWeekWithEveryDayClosedPasses() => Fields(Request(Week(open: []))).ShouldBeEmpty();

    [Fact]
    public void TheFullRangeFiveToElevenThirtyPasses() =>
        Fields(Request(Week(open: [], override1: new DayHoursDto(1, "05:00", "23:30")))).ShouldBeEmpty();

    [Fact]
    public void AnOpenDayWithNoOpeningTimeIsRefusedOnThatDay() =>
        Fields(Request(Week(open: [], override1: new DayHoursDto(1, null, "18:00"))))
            .ShouldBe([("days[0].opensAt", "Choose the opening time.")]);

    [Fact]
    public void AnOpenDayWithNoClosingTimeIsRefusedOnThatDay() =>
        Fields(Request(Week(open: [], override1: new DayHoursDto(3, "09:00", " "))))
            .ShouldBe([("days[2].closesAt", "Choose the closing time.")]);

    [Theory]
    [InlineData("18:00", "09:00")]
    [InlineData("09:00", "09:00")]
    public void ClosingAtOrBeforeOpeningIsRefusedOnTheClosingTime(string opens, string closes) =>
        Fields(Request(Week(open: [], override1: new DayHoursDto(1, opens, closes))))
            .ShouldBe([("days[0].closesAt", "Closing time must be after opening time.")]);

    [Theory]
    [InlineData("09:15")]
    [InlineData("09:45")]
    [InlineData("04:30")]
    [InlineData("23:45")]
    [InlineData("9am")]
    [InlineData("9:00")]
    [InlineData("24:00")]
    public void AnOpeningTimeThatIsNotOnTheHalfHourInRangeIsRefused(string opens) =>
        Fields(Request(Week(open: [], override1: new DayHoursDto(1, opens, "23:30"))))
            .ShouldContain(("days[0].opensAt", StepMessage));

    [Theory]
    [InlineData("17:45")]
    [InlineData("23:45")]
    [InlineData("noon")]
    public void AClosingTimeThatIsNotOnTheHalfHourInRangeIsRefused(string closes) =>
        Fields(Request(Week(open: [], override1: new DayHoursDto(1, "05:00", closes))))
            .ShouldContain(("days[0].closesAt", StepMessage));

    [Fact]
    public void SixDaysAreRefused() =>
        Fields(Request(Week(open: []).Take(6).ToList()))
            .ShouldBe([("days", "Send the hours for all seven days, once each.")]);

    [Fact]
    public void ARepeatedDayIsRefused()
    {
        var days = Week(open: []).ToList();
        days[6] = new DayHoursDto(1, null, null);

        Fields(Request(days)).ShouldBe([("days", "Send the hours for all seven days, once each.")]);
    }

    [Fact]
    public void ADayOutsideOneToSevenIsRefused()
    {
        var days = Week(open: []).ToList();
        days[6] = new DayHoursDto(8, null, null);

        Fields(Request(days)).ShouldBe([("days", "Send the hours for all seven days, once each.")]);
    }

    [Fact]
    public void ADayInAnyOrderIsAccepted() => Fields(Request([.. Enumerable.Reverse(Week(open: [1]))])).ShouldBeEmpty();

    [Fact]
    public void AMissingVersionIsRefused() =>
        Fields(Request(Week(open: [])) with { Version = null }).ShouldBe([("version", RowVersions.InvalidMessage)]);

    [Fact]
    public void AnEightByteRowVersionIsNotAWeekVersion() =>
        Fields(Request(Week(open: [])) with { Version = "AAAAAAAAB9E=" }).ShouldBe([("version", RowVersions.InvalidMessage)]);

    [Fact]
    public void AnEmptyBodyReportsTheVersionAndTheDaysAtOnce() =>
        Fields(UpdateOpeningHoursRequest.Empty)
            .ShouldBe([("days", "Send the hours for all seven days, once each."), ("version", RowVersions.InvalidMessage)]);

    [Fact]
    public void ANullDayEntryIsRefusedAsAWholeWeekProblem() =>
        Fields(Request([.. Week(open: []).Take(6), null!])).ShouldBe([("days", "Send the hours for all seven days, once each.")]);

    private static UpdateOpeningHoursRequest Request(IReadOnlyList<DayHoursDto> days) => new(Version, days);

    // Seven days, Monday first; the listed days are 09:00 to 18:00 and the rest are closed. One day can be replaced.
    private static List<DayHoursDto> Week(IReadOnlyCollection<int> open, DayHoursDto? override1 = null)
    {
        var days = Enumerable.Range(1, 7)
            .Select(day => open.Contains(day) ? new DayHoursDto(day, "09:00", "18:00") : new DayHoursDto(day, null, null))
            .ToList();
        if (override1 is not null)
        {
            days[override1.Day - 1] = override1;
        }

        return days;
    }

    // The errors as (path, message), sorted so the order of the rules never matters.
    private static List<(string Field, string Message)> Fields(UpdateOpeningHoursRequest request)
    {
        var result = Validator.Validate(request);
        var error = result.IsValid ? null : ValidationResults.ToError(result, "code", "message");
        return error is null
            ? []
            : [.. error.FieldErrors!.OrderBy(pair => pair.Key, StringComparer.Ordinal).SelectMany(pair => pair.Value.Select(message => (pair.Key, message)))];
    }
}
