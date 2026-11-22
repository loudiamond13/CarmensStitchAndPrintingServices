using Csps.Application.Analytics;
using Csps.Application.Ports;
using Csps.Domain.Time;

namespace Csps.Application.UnitTests.Analytics;

/// <summary>
/// ANL-08, D-24, D-04, OR-3: a custom range needs a real start and end day between the 3-year floor and today, with the same messages the page
/// shows. A preset, or no range at all, is never refused.
/// </summary>
public sealed class VisitorStatsRequestValidatorTests
{
    // 00:30 in the fixed UTC+8 zone on 2026-11-16, so the business day differs from the UTC day. The floor is 2023-11-16.
    private static readonly DateTimeOffset Now = new(2026, 11, 15, 16, 30, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");

    private readonly VisitorStatsRequestValidator _validator = new(new FixedCalendar(new BusinessClock(Manila, ZoneSource.Stored, Now)));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("last-7-days")]
    [InlineData("last-30-days")]
    [InlineData("this-month")]
    [InlineData("last-month")]
    [InlineData("this-year")]
    [InlineData("bogus")]
    public async Task APresetAnUnknownNameOrNoRangeIsAcceptedEvenWithJunkDates(string? range)
    {
        var result = await _validator.ValidateAsync(new VisitorStatsRequest(range, "not-a-date", "1999-01-01"), TestContext.Current.CancellationToken);

        result.IsValid.ShouldBeTrue();
    }

    [Fact]
    public async Task ACustomRangeWithoutAStartDateIsAskedForOne()
    {
        var result = await _validator.ValidateAsync(new VisitorStatsRequest("custom", null, "2026-11-10"), TestContext.Current.CancellationToken);

        Failure(result).ShouldBe(("From", "Enter a start date."));
    }

    [Fact]
    public async Task ACustomRangeWithoutAnEndDateIsAskedForOne()
    {
        var result = await _validator.ValidateAsync(new VisitorStatsRequest("custom", "2026-11-10", "  "), TestContext.Current.CancellationToken);

        Failure(result).ShouldBe(("To", "Enter an end date."));
    }

    [Fact]
    public async Task ACustomRangeWithNeitherDateIsAskedForBoth()
    {
        var result = await _validator.ValidateAsync(new VisitorStatsRequest("custom"), TestContext.Current.CancellationToken);

        result.Errors.Select(error => (error.PropertyName, error.ErrorMessage)).ShouldBe([("From", "Enter a start date."), ("To", "Enter an end date.")]);
    }

    [Theory]
    [InlineData("2026-02-30")]
    [InlineData("2026-2-3")]
    [InlineData("20261105")]
    [InlineData("tomorrow")]
    [InlineData("2026-11-05T10:00:00")]
    public async Task ADateThatIsNotARealDayIsRefused(string text)
    {
        var start = await _validator.ValidateAsync(new VisitorStatsRequest("custom", text, "2026-11-10"), TestContext.Current.CancellationToken);
        var end = await _validator.ValidateAsync(new VisitorStatsRequest("custom", "2026-11-01", text), TestContext.Current.CancellationToken);

        Failure(start).ShouldBe(("From", "Enter a real date."));
        Failure(end).ShouldBe(("To", "Enter a real date."));
    }

    [Fact]
    public async Task AStartAfterTheEndIsRefusedOnTheStartField()
    {
        var result = await _validator.ValidateAsync(new VisitorStatsRequest("custom", "2026-11-10", "2026-11-09"), TestContext.Current.CancellationToken);

        Failure(result).ShouldBe(("From", "The start date must be on or before the end date."));
    }

    [Fact]
    public async Task ASingleDayRangeIsAccepted()
    {
        var result = await _validator.ValidateAsync(new VisitorStatsRequest("custom", "2026-11-10", "2026-11-10"), TestContext.Current.CancellationToken);

        result.IsValid.ShouldBeTrue();
    }

    [Fact]
    public async Task TheFloorDayAndTodayInTheBusinessZoneAreAccepted()
    {
        var result = await _validator.ValidateAsync(new VisitorStatsRequest("custom", "2023-11-16", "2026-11-16"), TestContext.Current.CancellationToken);

        result.IsValid.ShouldBeTrue();
    }

    [Fact]
    public async Task TheDayBeforeTheFloorIsRefusedWithTheWindowMessage()
    {
        var result = await _validator.ValidateAsync(new VisitorStatsRequest("custom", "2023-11-15", "2026-11-16"), TestContext.Current.CancellationToken);

        Failure(result).ShouldBe(("From", "Choose a date from Nov 16, 2023 to today."));
    }

    [Fact]
    public async Task TomorrowInTheBusinessZoneIsRefusedWithTheWindowMessage()
    {
        var result = await _validator.ValidateAsync(new VisitorStatsRequest("custom", "2026-11-10", "2026-11-17"), TestContext.Current.CancellationToken);

        Failure(result).ShouldBe(("To", "Choose a date from Nov 16, 2023 to today."));
    }

    [Fact]
    public async Task TwoDatesOutsideTheWindowGetTheWindowMessageEachAndNoOrderMessage()
    {
        var result = await _validator.ValidateAsync(new VisitorStatsRequest("custom", "2030-01-01", "2020-01-01"), TestContext.Current.CancellationToken);

        result.Errors.Select(error => (error.PropertyName, error.ErrorMessage)).ShouldBe(
            [("From", "Choose a date from Nov 16, 2023 to today."), ("To", "Choose a date from Nov 16, 2023 to today.")]);
    }

    [Fact]
    public void TheMessagesAreTheAuditLogOnesPlusTheTwoRequiredOnes()
    {
        VisitorStatsRequestValidator.StartRequired.ShouldBe("Enter a start date.");
        VisitorStatsRequestValidator.EndRequired.ShouldBe("Enter an end date.");
        VisitorStatsRequestValidator.InvalidCode.ShouldBe("analytics.invalid-visitor-stats");
    }

    private static (string Field, string Message) Failure(FluentValidation.Results.ValidationResult result)
    {
        var error = result.Errors.ShouldHaveSingleItem();
        return (error.PropertyName, error.ErrorMessage);
    }

    private sealed class FixedCalendar(BusinessClock clock) : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) => ValueTask.FromResult(clock);
    }
}
