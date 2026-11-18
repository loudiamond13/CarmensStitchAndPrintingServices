using System.Globalization;
using Csps.Application.Analytics;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
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
    // 12:00 in Manila on 2026-11-15. The cut is 2025-10-15.
    private static readonly DateTimeOffset Noon = new(2026, 11, 15, 4, 0, 0, TimeSpan.Zero);
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

    [Fact]
    public async Task ARangeEndingTheDayBeforeTheCutHasNoVisitFiguresAndKeepsThePageViews()
    {
        var harness = new Harness(new VisitorTotals(0, 0, 50), Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2024-01-01", "2025-10-14"), TestContext.Current.CancellationToken);

        result.Value.CutDate.ShouldBe("2025-10-15");
        result.Value.Totals.ShouldBe(new VisitorTotalsDto(null, null, 50, null));
    }

    [Fact]
    public async Task ARangeCrossingTheCutCountsFromTheCutAndSaysSo()
    {
        var harness = new Harness(new VisitorTotals(12, 15, 300), Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2025-10-01", "2026-11-15"), TestContext.Current.CancellationToken);

        result.Value.Totals.ShouldBe(new VisitorTotalsDto(12, 15, 300, "2025-10-15"));
    }

    [Fact]
    public async Task ARangeThatStartsOnTheCutDayCountsThatDayAsRawAndNeedsNoNote()
    {
        var harness = new Harness(new VisitorTotals(1, 1, 4), Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2025-10-15", "2025-10-15"), TestContext.Current.CancellationToken);

        result.Value.Totals.ShouldBe(new VisitorTotalsDto(1, 1, 4, null));
    }

    [Fact]
    public async Task ARangeAllAfterTheCutHasNoNote()
    {
        var harness = new Harness(new VisitorTotals(3, 4, 5), Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("last-30-days"), TestContext.Current.CancellationToken);

        result.Value.Totals.ShouldBe(new VisitorTotalsDto(3, 4, 5, null));
    }

    [Fact]
    public async Task AnEmptyMonthInsideThirteenMonthsAnswersZerosNotNulls()
    {
        var harness = new Harness(new VisitorTotals(0, 0, 0), Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2026-09-01", "2026-09-30"), TestContext.Current.CancellationToken);

        result.Value.Totals.ShouldBe(new VisitorTotalsDto(0, 0, 0, null));
    }

    [Fact]
    public async Task ADayRangeHasOneBucketPerDayWithTheStoreCountsOnTheirDaysAndZerosElsewhere()
    {
        var harness = new Harness(now: Noon, trend: [new TrendCount(new DateOnly(2026, 11, 12), 4, 2)]);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2026-11-10", "2026-11-14"), TestContext.Current.CancellationToken);

        result.Value.Bucket.ShouldBe("day");
        result.Value.Trend.ShouldBe([
            new TrendBucketDto("2026-11-10", 0, 0),
            new TrendBucketDto("2026-11-11", 0, 0),
            new TrendBucketDto("2026-11-12", 4, 2),
            new TrendBucketDto("2026-11-13", 0, 0),
            new TrendBucketDto("2026-11-14", 0, 0),
        ]);
        await harness.Reader.Received(1).ReadTrendAsync(
            new DateOnly(2026, 11, 10), new DateOnly(2026, 11, 14), new DateOnly(2025, 10, 15), StatsBucketKind.Day, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheDefaultRangeHasThirtyDayBuckets()
    {
        var harness = new Harness(now: Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.Bucket.ShouldBe("day");
        result.Value.Trend.Count.ShouldBe(30);
        (result.Value.Trend[0].Start, result.Value.Trend[^1].Start).ShouldBe(("2026-10-17", "2026-11-15"));
    }

    [Fact]
    public async Task ThisYearHasOneMonthBucketPerMonthWithTheStoreCountsOnTheirMonths()
    {
        var harness = new Harness(now: Noon, trend: [new TrendCount(new DateOnly(2026, 3, 1), 40, 7)]);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("this-year"), TestContext.Current.CancellationToken);

        result.Value.Bucket.ShouldBe("month");
        result.Value.Trend.Select(static b => b.Start).ShouldBe(Enumerable.Range(1, 11).Select(static m => $"2026-{m:00}-01"));
        result.Value.Trend[2].ShouldBe(new TrendBucketDto("2026-03-01", 40, 7));
        result.Value.Trend[0].ShouldBe(new TrendBucketDto("2026-01-01", 0, 0));
        await harness.Reader.Received(1).ReadTrendAsync(
            new DateOnly(2026, 1, 1), new DateOnly(2026, 11, 15), new DateOnly(2025, 10, 15), StatsBucketKind.Month, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task A365DayRangeIsThirteenMonthBucketsAndTheFirstStartsOnTheRangeStart()
    {
        var harness = new Harness(now: Noon, trend: [new TrendCount(new DateOnly(2025, 11, 1), 5, 2)]);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2025-11-16", "2026-11-15"), TestContext.Current.CancellationToken);

        result.Value.Bucket.ShouldBe("month");
        result.Value.Trend.Count.ShouldBe(13);
        result.Value.Trend[0].ShouldBe(new TrendBucketDto("2025-11-16", 5, 2));
        (result.Value.Trend[1].Start, result.Value.Trend[^1].Start).ShouldBe(("2025-12-01", "2026-11-01"));
    }

    [Fact]
    public async Task MonthsWhollyBeforeTheCutHaveNoUniqueVisitorsAndKeepTheirPageViews()
    {
        var harness = new Harness(now: Noon, trend: [new TrendCount(new DateOnly(2025, 9, 1), 30, 0), new TrendCount(new DateOnly(2025, 10, 1), 20, 3)]);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2024-01-01", "2026-11-15"), TestContext.Current.CancellationToken);

        var trend = result.Value.Trend;
        trend.Count.ShouldBe(35);
        trend.Take(21).ShouldAllBe(static b => b.UniqueVisitors == null);
        trend[20].ShouldBe(new TrendBucketDto("2025-09-01", 30, null));
        // October 2025 crosses the cut (Oct 15): it counts from the cut.
        trend[21].ShouldBe(new TrendBucketDto("2025-10-01", 20, 3));
        trend.Skip(22).ShouldAllBe(static b => b.UniqueVisitors == 0);
    }

    [Fact]
    public async Task AMonthCutShortByARangeEndingTheDayBeforeTheCutHasNoUniqueVisitors()
    {
        var harness = new Harness(now: Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2025-01-01", "2025-10-14"), TestContext.Current.CancellationToken);

        result.Value.Trend.Count.ShouldBe(10);
        result.Value.Trend.ShouldAllBe(static b => b.UniqueVisitors == null);
    }

    [Fact]
    public async Task ADayBeforeTheCutHasNoUniqueVisitorsAndTheCutDayItselfCounts()
    {
        var harness = new Harness(now: Noon, trend: [new TrendCount(new DateOnly(2025, 10, 14), 9, 0)]);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2025-10-10", "2025-10-20"), TestContext.Current.CancellationToken);

        result.Value.Bucket.ShouldBe("day");
        result.Value.Trend.Take(5).ShouldAllBe(static b => b.UniqueVisitors == null);
        result.Value.Trend[4].ShouldBe(new TrendBucketDto("2025-10-14", 9, null));
        result.Value.Trend[5].ShouldBe(new TrendBucketDto("2025-10-15", 0, 0));
    }

    [Theory]
    [InlineData("2026-09-15", "day", 62)]
    [InlineData("2026-09-14", "month", 3)]
    public async Task SixtyTwoDaysArePerDayAndSixtyThreeArePerMonth(string from, string bucket, int count)
    {
        var harness = new Harness(now: Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", from, "2026-11-15"), TestContext.Current.CancellationToken);

        result.Value.Bucket.ShouldBe(bucket);
        result.Value.Trend.Count.ShouldBe(count);
        result.Value.Trend[0].Start.ShouldBe(from);
    }

    [Fact]
    public async Task TopPagesAreOrderedByViewsThenNameWithSharesThatAddUpTo100()
    {
        var harness = new Harness(now: Noon, lists: Lists(pages: [new("home", 1), new("gallery", 3), new("contact", 1)]));

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.TopPages.ShouldBe([new RankedItemDto("gallery", 3, 60), new RankedItemDto("contact", 1, 20), new RankedItemDto("home", 1, 20)]);
        await harness.Reader.Received(1).ReadListsAsync(new DateOnly(2026, 10, 17), new DateOnly(2026, 11, 15), new DateOnly(2025, 10, 15), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task OnePageIsAFullShare()
    {
        var harness = new Harness(now: Noon, lists: Lists(pages: [new("home", 9)]));

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.TopPages.ShouldBe([new RankedItemDto("home", 9, 100)]);
    }

    [Fact]
    public async Task NoPageViewsIsAnEmptyList()
    {
        var harness = new Harness(now: Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.TopPages.ShouldBeEmpty();
    }

    [Fact]
    public async Task EqualVisitCountsComeInNameOrderSoTheOrderNeverChanges()
    {
        var harness = new Harness(now: Noon, lists: Lists(referrers: [new("Messenger", 5), new("Direct", 9), new("Facebook", 5), new("facebook.com", 5)]));

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.Referrers.Select(static row => row.Name).ShouldBe(["Direct", "Facebook", "Messenger", "facebook.com"]);
        result.Value.Referrers.Sum(static row => row.Share).ShouldBe(100);
    }

    [Fact]
    public async Task ReferrersKeepTheTopTenAsStoredWithSharesOfAllVisits()
    {
        string[] hosts = ["basketball-league.ph", "Direct", "Facebook", "Google", "Instagram", "Messenger", "a.example", "b.example", "c.example", "d.example", "e.example", "f.example"];
        var harness = new Harness(now: Noon, lists: Lists(referrers: [.. hosts.Select(static (name, index) => new NamedCount(name, 20 - index))]));

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.Referrers.Count.ShouldBe(10);
        result.Value.Referrers[0].ShouldBe(new RankedItemDto("basketball-league.ph", 20, 12));
        result.Value.Referrers.Select(static row => row.Name).ShouldBe(hosts.Take(10));
        result.Value.Referrers.Sum(static row => row.Share).ShouldBe(89, "the two rows past the tenth keep their share of all visits");
    }

    [Fact]
    public async Task DevicesAreListedByVisitsWithTheirStoredNames()
    {
        var harness = new Harness(now: Noon, lists: Lists(devices: [new("Tablet", 1), new("Phone", 7), new("Computer", 2)]));

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.Devices.ShouldBe([new RankedItemDto("Phone", 7, 70), new RankedItemDto("Computer", 2, 20), new RankedItemDto("Tablet", 1, 10)]);
    }

    [Fact]
    public async Task SevenBrowsersAreTheTopFiveThenOtherWithSharesThatAddUpTo100()
    {
        var harness = new Harness(
            now: Noon,
            lists: Lists(browsers: [new("Edge", 5), new("Chrome", 41), new("Opera", 4), new("Safari", 20), new("Firefox", 6), new("Facebook in-app", 15), new("Samsung Internet", 10)]));

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.Browsers.ShouldBe([
            new RankedItemDto("Chrome", 41, 40),
            new RankedItemDto("Safari", 20, 20),
            new RankedItemDto("Facebook in-app", 15, 15),
            new RankedItemDto("Samsung Internet", 10, 10),
            new RankedItemDto("Firefox", 6, 6),
            new RankedItemDto("Other", 9, 9),
        ]);
    }

    [Fact]
    public async Task AStoredOtherBrowserJoinsTheOtherRowWhichComesLast()
    {
        var harness = new Harness(now: Noon, lists: Lists(browsers: [new("Other", 4), new("Chrome", 1)]));

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.Browsers.ShouldBe([new RankedItemDto("Chrome", 1, 20), new RankedItemDto("Other", 4, 80)]);
    }

    [Fact]
    public async Task FiveBrowsersOrFewerHaveNoOtherRow()
    {
        var harness = new Harness(now: Noon, lists: Lists(browsers: [new("Chrome", 3), new("Safari", 1)]));

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.Browsers.ShouldBe([new RankedItemDto("Chrome", 3, 75), new RankedItemDto("Safari", 1, 25)]);
    }

    [Fact]
    public async Task NoVisitsGiveEmptyReferrerDeviceAndBrowserLists()
    {
        var harness = new Harness(now: Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.Referrers.ShouldBeEmpty();
        result.Value.Devices.ShouldBeEmpty();
        result.Value.Browsers.ShouldBeEmpty();
    }

    private static VisitorLists Lists(
        NamedCount[]? pages = null,
        NamedCount[]? referrers = null,
        NamedCount[]? devices = null,
        NamedCount[]? browsers = null) =>
        new(pages ?? [], referrers ?? [], devices ?? [], browsers ?? []);

    private sealed class Harness
    {
        public Harness(VisitorTotals? totals = null, DateTimeOffset? now = null, IReadOnlyList<TrendCount>? trend = null, VisitorLists? lists = null)
        {
            Reader = Substitute.For<IVisitorStatsReader>();
            Reader.ReadTotalsAsync(Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(totals ?? new VisitorTotals(0, 0, 0)));
            Reader.ReadTrendAsync(Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<StatsBucketKind>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(trend ?? []));
            Reader.ReadListsAsync(Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(lists ?? Lists()));
            var calendar = new FixedCalendar(new BusinessClock(Manila, ZoneSource.Stored, now ?? ManilaMidnight));
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
