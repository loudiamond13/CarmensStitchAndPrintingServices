using System.Globalization;
using Csps.Application.Analytics;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Analytics;

/// <summary>
/// ANL-08, D-24, D-33: the handler resolves the range in the business zone, never reads the reader for a bad query, and returns the dates it
/// used and the cut date.
/// </summary>
public sealed class GetVisitorStatsHandlerTests
{
    // 00:30 in the fixed UTC+8 zone on 2026-11-16, while the UTC day is still 2026-11-15. The cut is 2025-10-16.
    private static readonly DateTimeOffset ManilaMidnight = new(2026, 11, 15, 16, 30, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");

    [Theory]
    [InlineData(null, "last-30-days", "2026-10-18", "2026-11-16")]
    [InlineData("", "last-30-days", "2026-10-18", "2026-11-16")]
    [InlineData("last-30-days", "last-30-days", "2026-10-18", "2026-11-16")]
    [InlineData("last-7-days", "last-7-days", "2026-11-10", "2026-11-16")]
    [InlineData("this-month", "this-month", "2026-11-01", "2026-11-16")]
    [InlineData("last-month", "last-month", "2026-10-01", "2026-10-31")]
    [InlineData("this-year", "this-year", "2026-01-01", "2026-11-16")]
    [InlineData("today", "last-30-days", "2026-10-18", "2026-11-16")]
    [InlineData("bogus", "last-30-days", "2026-10-18", "2026-11-16")]
    public async Task APresetIsResolvedAgainstTheBusinessDayAndTheDatesUsedAreReturned(string? range, string name, string from, string to)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(range), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Range.ShouldBe(name);
        result.Value.From.ShouldBe(from);
        result.Value.To.ShouldBe(to);
        result.Value.CutDate.ShouldBe("2025-10-16");
        await harness.Reader.Received(1).ReadTotalsAsync(
            DateOnly.Parse(from, CultureInfo.InvariantCulture),
            DateOnly.Parse(to, CultureInfo.InvariantCulture),
            new DateOnly(2025, 10, 16),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ACustomRangeIsUsedAsGivenAndAOneDayRangeIsOneDay()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2026-11-05", "2026-11-05"), TestContext.Current.CancellationToken);

        result.Value.Range.ShouldBe("custom");
        (result.Value.From, result.Value.To).ShouldBe(("2026-11-05", "2026-11-05"));
        await harness.Reader.Received(1).ReadTotalsAsync(new DateOnly(2026, 11, 5), new DateOnly(2026, 11, 5), new DateOnly(2025, 10, 16), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ABadCustomRangeFailsWithTheFieldMessageAndNeverReadsTheStore()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", null, "2026-11-05"), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe("analytics.invalid-visitor-stats");
        result.Error.FieldErrors.ShouldNotBeNull()["from"].ShouldBe(["Enter a start date."]);
        await harness.Reader.DidNotReceiveWithAnyArgs().ReadTotalsAsync(default, default, default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task TheTotalsFromTheStoreAreReturnedAsTheyAre()
    {
        var harness = new Harness(new VisitorTotals(7, 9, 120));

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.Totals.ShouldBe(new VisitorTotalsDto(7, 9, 120, null));
    }

    private sealed class Harness
    {
        public Harness(VisitorTotals? totals = null)
        {
            Reader = Substitute.For<IVisitorStatsReader>();
            Reader.ReadTotalsAsync(Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(totals ?? new VisitorTotals(0, 0, 0)));
            var calendar = new FixedCalendar(new BusinessClock(Manila, ZoneSource.Stored, ManilaMidnight));
            Handler = new GetVisitorStatsHandler(Reader, calendar, new VisitorStatsRequestValidator(calendar));
        }

        public IVisitorStatsReader Reader { get; }

        public GetVisitorStatsHandler Handler { get; }
    }

    private sealed class FixedCalendar(BusinessClock clock) : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) => ValueTask.FromResult(clock);
    }
}
