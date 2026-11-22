using Csps.Application.Analytics;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Analytics;

/// <summary>
/// ANL-08, D-69, D-75: the export has one row per day and page that had views, with the page's name, ordered by date and then the fixed page
/// order. A day or a page with no views has no line, and a range with no views is the header alone.
/// </summary>
public sealed class ExportVisitorStatsHandlerTests
{
    private const string Header = "Date,Page,Page views";

    // 12:00 in Manila on 2026-11-15.
    private static readonly DateTimeOffset Noon = new(2026, 11, 15, 4, 0, 0, TimeSpan.Zero);
    // 00:30 in the fixed UTC+8 zone on 2026-11-16, while the UTC day is still 2026-11-15.
    private static readonly DateTimeOffset ManilaMidnight = new(2026, 11, 15, 16, 30, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");

    [Fact]
    public async Task ARangeWithNoViewsIsTheHeaderAlone()
    {
        var harness = new Harness(Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2026-11-01", "2026-11-05"), TestContext.Current.CancellationToken);

        result.Value.FileName.ShouldBe("visitor-stats-2026-11-01-to-2026-11-05.csv");
        result.Value.Csv.ShouldBe($"{Header}\r\n");
    }

    [Fact(DisplayName = "leaves out days with no views and orders by date then page order")]
    public async Task LeavesOutDaysWithNoViewsAndOrdersByDateThenPageOrder()
    {
        var harness = new Harness(
            Noon,
            new DailyPageViews(new DateOnly(2026, 11, 4), "gallery", 5),
            new DailyPageViews(new DateOnly(2026, 11, 2), "cookies", 2),
            new DailyPageViews(new DateOnly(2026, 11, 2), "gallery", 1),
            new DailyPageViews(new DateOnly(2026, 11, 2), "about", 9),
            new DailyPageViews(new DateOnly(2026, 11, 2), "products", 7),
            new DailyPageViews(new DateOnly(2026, 11, 2), "home", 40));

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2026-11-01", "2026-11-04"), TestContext.Current.CancellationToken);

        Lines(result.Value.Csv).ShouldBe(
        [
            Header,
            "2026-11-02,Home,40",
            "2026-11-02,Products,7",
            "2026-11-02,Gallery,1",
            "2026-11-02,about,9",
            "2026-11-02,cookies,2",
            "2026-11-04,Gallery,5",
        ]);
        await harness.Reader.Received(1).ReadDailyPagesAsync(new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 4), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EveryNamedPageShowsItsNameInTheFixedOrder()
    {
        var day = new DateOnly(2026, 11, 3);
        var harness = new Harness(
            Noon,
            new DailyPageViews(day, "not-found", 8),
            new DailyPageViews(day, "accessibility", 7),
            new DailyPageViews(day, "terms", 6),
            new DailyPageViews(day, "privacy", 5),
            new DailyPageViews(day, "contact", 4),
            new DailyPageViews(day, "gallery", 3),
            new DailyPageViews(day, "products", 2),
            new DailyPageViews(day, "home", 1));

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2026-11-03", "2026-11-03"), TestContext.Current.CancellationToken);

        Lines(result.Value.Csv).ShouldBe(
        [
            Header,
            "2026-11-03,Home,1",
            "2026-11-03,Products,2",
            "2026-11-03,Gallery,3",
            "2026-11-03,Contact,4",
            "2026-11-03,Privacy Policy,5",
            "2026-11-03,Terms of Use,6",
            "2026-11-03,Accessibility Statement,7",
            "2026-11-03,Page not found,8",
        ]);
    }

    [Fact]
    public async Task ARowWithNoViewsIsLeftOut()
    {
        var harness = new Harness(Noon, new DailyPageViews(new DateOnly(2026, 11, 2), "home", 0), new DailyPageViews(new DateOnly(2026, 11, 2), "gallery", 4));

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2026-11-01", "2026-11-04"), TestContext.Current.CancellationToken);

        Lines(result.Value.Csv).ShouldBe([Header, "2026-11-02,Gallery,4"]);
    }

    [Fact]
    public async Task APresetAtManilaMidnightUsesTheBusinessDaysNotTheUtcDays()
    {
        var harness = new Harness(ManilaMidnight);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("last-7-days"), TestContext.Current.CancellationToken);

        result.Value.FileName.ShouldBe("visitor-stats-2026-11-10-to-2026-11-16.csv");
        await harness.Reader.Received(1).ReadDailyPagesAsync(new DateOnly(2026, 11, 10), new DateOnly(2026, 11, 16), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task WithNoRangeTheLastThirtyDaysAreExported()
    {
        var harness = new Harness(Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.FileName.ShouldBe("visitor-stats-2026-10-17-to-2026-11-15.csv");
        await harness.Reader.Received(1).ReadDailyPagesAsync(new DateOnly(2026, 10, 17), new DateOnly(2026, 11, 15), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ABadCustomRangeFailsWithTheFieldMessageAndNeverReadsTheStore()
    {
        var harness = new Harness(Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2026-11-05", null), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["to"].ShouldBe(["Enter an end date."]);
        await harness.Reader.DidNotReceiveWithAnyArgs().ReadDailyPagesAsync(default, default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task TheFileHoldsOnlyTheThreeColumns()
    {
        var harness = new Harness(Noon, new DailyPageViews(new DateOnly(2026, 11, 15), "home", 4567), new DailyPageViews(new DateOnly(2026, 11, 14), "privacy", 3));

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("last-7-days"), TestContext.Current.CancellationToken);

        Lines(result.Value.Csv).ShouldAllBe(static line => line.Split(',').Length == 3);
    }

    private static List<string> Lines(string csv)
    {
        csv.ShouldEndWith("\r\n");
        return [.. csv[..^2].Split("\r\n")];
    }

    private sealed class Harness
    {
        public Harness(DateTimeOffset now, params DailyPageViews[] rows)
        {
            Reader = Substitute.For<IVisitorStatsReader>();
            Reader.ReadDailyPagesAsync(Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<IReadOnlyList<DailyPageViews>>(rows));
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
