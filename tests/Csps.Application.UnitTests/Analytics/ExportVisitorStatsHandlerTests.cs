using Csps.Application.Analytics;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Analytics;

/// <summary>
/// ANL-08, D-25, D-27: the export has one row per business day of the range. A day with no data is zeros, and a day before the 13-month cut
/// has empty unique visitor and visit cells while its page views stay a number.
/// </summary>
public sealed class ExportVisitorStatsHandlerTests
{
    private const string Header = "Date,Unique visitors,Visits,Page views";

    // 12:00 in Manila on 2026-11-15. The cut is 2025-10-15.
    private static readonly DateTimeOffset Noon = new(2026, 11, 15, 4, 0, 0, TimeSpan.Zero);
    // 00:30 in the fixed UTC+8 zone on 2026-11-16, while the UTC day is still 2026-11-15. The cut is 2025-10-16.
    private static readonly DateTimeOffset ManilaMidnight = new(2026, 11, 15, 16, 30, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");

    [Fact]
    public async Task ARangeWithNoDataHasOneZeroRowPerDay()
    {
        var harness = new Harness(Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2026-11-01", "2026-11-05"), TestContext.Current.CancellationToken);

        result.Value.FileName.ShouldBe("visitor-stats-2026-11-01-to-2026-11-05.csv");
        Lines(result.Value.Csv).ShouldBe(
            [Header, "2026-11-01,0,0,0", "2026-11-02,0,0,0", "2026-11-03,0,0,0", "2026-11-04,0,0,0", "2026-11-05,0,0,0"]);
    }

    [Fact]
    public async Task TheStoreFiguresFillTheirDaysAndTheOtherDaysAreZeros()
    {
        var harness = new Harness(Noon, new DailyCount(new DateOnly(2026, 11, 2), 40, 9, 7), new DailyCount(new DateOnly(2026, 11, 4), 5, 0, 0));

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2026-11-01", "2026-11-04"), TestContext.Current.CancellationToken);

        Lines(result.Value.Csv).ShouldBe([Header, "2026-11-01,0,0,0", "2026-11-02,7,9,40", "2026-11-03,0,0,0", "2026-11-04,0,0,5"]);
        await harness.Reader.Received(1).ReadDailyAsync(new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 4), new DateOnly(2025, 10, 15), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DaysBeforeTheCutHaveEmptyVisitorAndVisitCellsButKeepTheirPageViews()
    {
        var harness = new Harness(Noon, new DailyCount(new DateOnly(2025, 10, 13), 12, 0, 0), new DailyCount(new DateOnly(2025, 10, 15), 8, 3, 2));

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2025-10-13", "2025-10-16"), TestContext.Current.CancellationToken);

        Lines(result.Value.Csv).ShouldBe([Header, "2025-10-13,,,12", "2025-10-14,,,0", "2025-10-15,2,3,8", "2025-10-16,0,0,0"]);
    }

    [Fact]
    public async Task APresetAtManilaMidnightUsesTheBusinessDaysNotTheUtcDays()
    {
        var harness = new Harness(ManilaMidnight);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("last-7-days"), TestContext.Current.CancellationToken);

        result.Value.FileName.ShouldBe("visitor-stats-2026-11-10-to-2026-11-16.csv");
        var lines = Lines(result.Value.Csv);
        lines.Count.ShouldBe(8);
        (lines[1], lines[7]).ShouldBe(("2026-11-10,0,0,0", "2026-11-16,0,0,0"));
    }

    [Fact]
    public async Task WithNoRangeTheLastThirtyDaysAreExported()
    {
        var harness = new Harness(Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.FileName.ShouldBe("visitor-stats-2026-10-17-to-2026-11-15.csv");
        Lines(result.Value.Csv).Count.ShouldBe(31);
    }

    [Fact]
    public async Task ABadCustomRangeFailsWithTheFieldMessageAndNeverReadsTheStore()
    {
        var harness = new Harness(Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2026-11-05", null), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["to"].ShouldBe(["Enter an end date."]);
        await harness.Reader.DidNotReceiveWithAnyArgs().ReadDailyAsync(default, default, default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task TheFileHoldsOnlyTheFourDailyTotalColumns()
    {
        var harness = new Harness(Noon, new DailyCount(new DateOnly(2026, 11, 15), 4567, 1500, 1234));

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("last-7-days"), TestContext.Current.CancellationToken);

        Lines(result.Value.Csv).ShouldAllBe(static line => line.Split(',').Length == 4);
    }

    private static List<string> Lines(string csv)
    {
        csv.ShouldEndWith("\r\n");
        return [.. csv[..^2].Split("\r\n")];
    }

    private sealed class Harness
    {
        public Harness(DateTimeOffset now, params DailyCount[] days)
        {
            Reader = Substitute.For<IVisitorStatsReader>();
            Reader.ReadDailyAsync(Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<IReadOnlyList<DailyCount>>(days));
            var calendar = new FixedCalendar(new BusinessClock(Manila, ZoneSource.Stored, now));
            Handler = new ExportVisitorStatsHandler(Reader, calendar, new VisitorStatsRequestValidator(calendar));
        }

        public IVisitorStatsReader Reader { get; }

        public ExportVisitorStatsHandler Handler { get; }
    }

    private sealed class FixedCalendar(BusinessClock clock) : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) => ValueTask.FromResult(clock);
    }
}
