using Csps.Application.Common;
using Csps.Application.Content;
using FluentValidation;

namespace Csps.Application.UnitTests.Content;

/// <summary>
/// CONT-04, OR-3, UI-SPEC validation: the closure form refuses bad input on its own field with the approved message. The first day is a
/// real date that is the business today or later, the last day is optional, on or after the first and at most 31 days in all, and the
/// note is at most 80 characters.
/// </summary>
public sealed class ShopClosureRequestValidatorTests
{
    private static readonly DateOnly Today = new(2026, 12, 1);
    private static readonly string Version = RowVersions.ToText(new byte[RowVersions.Length]);
    private static readonly ShopClosureRequestValidator Validator = new();

    [Fact]
    public void AFirstDayAloneForTodayPasses() => Fields(Request("2026-12-01", null, null)).ShouldBeEmpty();

    [Fact]
    public void ALastDayAndANotePass() => Fields(Request("2026-12-24", "2026-12-26", "Christmas")).ShouldBeEmpty();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ANoFirstDayIsRefused(string? first) =>
        Fields(Request(first, null, null)).ShouldBe([("firstDay", "Enter the first day.")]);

    [Theory]
    [InlineData("2026-02-30")]
    [InlineData("12/25/2026")]
    [InlineData("tomorrow")]
    public void AFirstDayThatIsNotARealDateIsRefused(string first) =>
        Fields(Request(first, null, null)).ShouldBe([("firstDay", "Enter a real date.")]);

    [Fact]
    public void AFirstDayOfYesterdayInBusinessTimeIsRefusedAndTodayPasses()
    {
        Fields(Request("2026-11-30", null, null)).ShouldBe([("firstDay", "Pick today or a later date.")]);
        Fields(Request("2026-12-01", null, null)).ShouldBeEmpty();
    }

    [Fact]
    public void ALastDayThatIsNotARealDateIsRefused() =>
        Fields(Request("2026-12-24", "2026-13-01", null)).ShouldBe([("lastDay", "Enter a real date.")]);

    [Fact]
    public void ALastDayBeforeTheFirstIsRefused() =>
        Fields(Request("2026-12-25", "2026-12-24", null)).ShouldBe([("lastDay", "The last day must be on or after the first day.")]);

    [Fact]
    public void AThirtyOneDayClosurePassesAndThirtyTwoDaysFail()
    {
        Fields(Request("2026-12-01", "2026-12-31", null)).ShouldBeEmpty();
        Fields(Request("2026-12-01", "2027-01-01", null)).ShouldBe([("lastDay", "A closure can be up to 31 days. Add another one for longer.")]);
    }

    [Fact]
    public void ANoteOfEightyCharactersPassesAndEightyOneFail()
    {
        Fields(Request("2026-12-24", null, new string('a', 80))).ShouldBeEmpty();
        Fields(Request("2026-12-24", null, new string('a', 81))).ShouldBe([("note", "Keep the note to 80 characters or fewer.")]);
    }

    [Fact]
    public void WhenEditingAPastFirstDayIsKeptSoTheNoteOfARunningClosureCanBeFixed() =>
        Fields(Request("2026-11-28", "2026-12-03", "Fixed", Version), edit: true).ShouldBeEmpty();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not base64!")]
    public void WhenEditingAMissingOrMalformedVersionIsRefused(string? version) =>
        Fields(Request("2026-12-24", null, null, version), edit: true).ShouldBe([("version", RowVersions.InvalidMessage)]);

    [Fact]
    public void WhenAddingTheVersionIsIgnored() => Fields(Request("2026-12-24", null, null, "not base64!")).ShouldBeEmpty();

    [Fact]
    public void AnEmptyRequestNamesTheFirstDay() =>
        Fields(ShopClosureRequest.Empty).ShouldBe([("firstDay", "Enter the first day.")]);

    [Fact]
    public void EveryBrokenFieldIsReportedAtOnce() =>
        Fields(Request("2026-11-30", "2026-11-29", new string('a', 81)))
            .ShouldBe([("firstDay", "Pick today or a later date."), ("lastDay", "The last day must be on or after the first day."), ("note", "Keep the note to 80 characters or fewer.")]);

    private static ShopClosureRequest Request(string? first, string? last, string? note, string? version = null) => new(first, last, note, version);

    private static List<(string Field, string Message)> Fields(ShopClosureRequest request, bool edit = false)
    {
        var context = new ValidationContext<ShopClosureRequest>(request);
        context.RootContextData[ShopClosureRequestValidator.TodayKey] = Today;
        if (edit)
        {
            context.RootContextData[ShopClosureRequestValidator.EditKey] = true;
        }

        return [.. Validator.Validate(context).Errors.Select(failure => (char.ToLowerInvariant(failure.PropertyName[0]) + failure.PropertyName[1..], failure.ErrorMessage))];
    }
}
