using System.Globalization;
using Csps.Application.Analytics;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Domain.Common;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Analytics;

/// <summary>
/// ANL-08, D-24, D-57, D-67, D-68: the handler resolves the range in the business zone, never reads the reader for a bad query, and answers
/// the page views, the trend and the top five pages from the daily page counts only.
/// </summary>
public sealed class GetVisitorStatsHandlerTests
{
    // 00:30 in the fixed UTC+8 zone on 2026-11-16, while the UTC day is still 2026-11-15.
    private static readonly DateTimeOffset ManilaMidnight = new(2026, 11, 15, 16, 30, 0, TimeSpan.Zero);
    // 12:00 in Manila on 2026-11-15.
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
        await harness.Reader.Received(1).ReadPageViewsAsync(
            DateOnly.Parse(from, CultureInfo.InvariantCulture),
            DateOnly.Parse(to, CultureInfo.InvariantCulture),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ACustomRangeIsUsedAsGivenAndAOneDayRangeIsOneDay()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2026-11-05", "2026-11-05"), TestContext.Current.CancellationToken);

        result.Value.Range.ShouldBe("custom");
        (result.Value.From, result.Value.To).ShouldBe(("2026-11-05", "2026-11-05"));
        await harness.Reader.Received(1).ReadPageViewsAsync(new DateOnly(2026, 11, 5), new DateOnly(2026, 11, 5), Arg.Any<CancellationToken>());
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
        await harness.Reader.DidNotReceiveWithAnyArgs().ReadPageViewsAsync(default, default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task ThePageViewTotalFromTheStoreIsReturnedAsItIs()
    {
        var harness = new Harness(pageViews: 120);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.PageViews.ShouldBe(120);
    }

    [Fact]
    public async Task ARangeThreeYearsBackIsReadLikeAnyOther()
    {
        var harness = new Harness(pageViews: 50, now: Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2023-11-15", "2023-11-30"), TestContext.Current.CancellationToken);

        result.Value.PageViews.ShouldBe(50);
        result.Value.Trend.Count.ShouldBe(16);
        await harness.Reader.Received(1).ReadPageViewsAsync(new DateOnly(2023, 11, 15), new DateOnly(2023, 11, 30), Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "answers page views, the top five pages with shares of all views, and the trend")]
    public async Task AnswersPageViewsTheTopFivePagesWithSharesOfAllViewsAndTheTrend()
    {
        var harness = new Harness(
            now: Noon,
            pageViews: 104,
            trend: [new TrendCount(new DateOnly(2026, 11, 12), 4)],
            pages:
            [
                new("terms", 3), new("gallery", 41), new("accessibility", 2), new("home", 26), new("privacy", 5), new("contact", 16), new("products", 11),
            ]);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.PageViews.ShouldBe(104);
        result.Value.TopPages.ShouldBe([
            new RankedItemDto("gallery", 41, 39),
            new RankedItemDto("home", 26, 25),
            new RankedItemDto("contact", 16, 15),
            new RankedItemDto("products", 11, 11),
            new RankedItemDto("privacy", 5, 5),
        ]);
        result.Value.Bucket.ShouldBe("day");
        result.Value.Trend.Count.ShouldBe(30);
        result.Value.Trend[0].ShouldBe(new TrendBucketDto("2026-10-17", 0));
        result.Value.Trend[26].ShouldBe(new TrendBucketDto("2026-11-12", 4));
        result.Value.Trend[^1].ShouldBe(new TrendBucketDto("2026-11-15", 0));
        await harness.Reader.Received(1).ReadPagesAsync(new DateOnly(2026, 10, 17), new DateOnly(2026, 11, 15), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ANinetyDayRangeAnswersMonthBuckets()
    {
        var harness = new Harness(now: Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2026-08-17", "2026-11-15"), TestContext.Current.CancellationToken);

        result.Value.Bucket.ShouldBe("month");
        result.Value.Trend.Select(static b => b.Start).ShouldBe(["2026-08-17", "2026-09-01", "2026-10-01", "2026-11-01"]);
    }

    [Fact]
    public async Task ADayRangeHasOneBucketPerDayWithTheStoreCountsOnTheirDaysAndZerosElsewhere()
    {
        var harness = new Harness(now: Noon, trend: [new TrendCount(new DateOnly(2026, 11, 12), 4)]);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2026-11-10", "2026-11-14"), TestContext.Current.CancellationToken);

        result.Value.Bucket.ShouldBe("day");
        result.Value.Trend.ShouldBe([
            new TrendBucketDto("2026-11-10", 0),
            new TrendBucketDto("2026-11-11", 0),
            new TrendBucketDto("2026-11-12", 4),
            new TrendBucketDto("2026-11-13", 0),
            new TrendBucketDto("2026-11-14", 0),
        ]);
        await harness.Reader.Received(1).ReadTrendAsync(
            new DateOnly(2026, 11, 10), new DateOnly(2026, 11, 14), StatsBucketKind.Day, Arg.Any<CancellationToken>());
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
        var harness = new Harness(now: Noon, trend: [new TrendCount(new DateOnly(2026, 3, 1), 40)]);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("this-year"), TestContext.Current.CancellationToken);

        result.Value.Bucket.ShouldBe("month");
        result.Value.Trend.Select(static b => b.Start).ShouldBe(Enumerable.Range(1, 11).Select(static m => $"2026-{m:00}-01"));
        result.Value.Trend[2].ShouldBe(new TrendBucketDto("2026-03-01", 40));
        result.Value.Trend[0].ShouldBe(new TrendBucketDto("2026-01-01", 0));
        await harness.Reader.Received(1).ReadTrendAsync(
            new DateOnly(2026, 1, 1), new DateOnly(2026, 11, 15), StatsBucketKind.Month, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task A365DayRangeIsThirteenMonthBucketsAndTheFirstStartsOnTheRangeStart()
    {
        var harness = new Harness(now: Noon, trend: [new TrendCount(new DateOnly(2025, 11, 1), 5)]);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest("custom", "2025-11-16", "2026-11-15"), TestContext.Current.CancellationToken);

        result.Value.Bucket.ShouldBe("month");
        result.Value.Trend.Count.ShouldBe(13);
        result.Value.Trend[0].ShouldBe(new TrendBucketDto("2025-11-16", 5));
        (result.Value.Trend[1].Start, result.Value.Trend[^1].Start).ShouldBe(("2025-12-01", "2026-11-01"));
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
        var harness = new Harness(now: Noon, pages: [new("home", 1), new("gallery", 3), new("contact", 1)]);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.TopPages.ShouldBe([new RankedItemDto("gallery", 3, 60), new RankedItemDto("contact", 1, 20), new RankedItemDto("home", 1, 20)]);
    }

    [Fact]
    public async Task OnePageIsAFullShare()
    {
        var harness = new Harness(now: Noon, pages: [new("home", 9)]);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.TopPages.ShouldBe([new RankedItemDto("home", 9, 100)]);
    }

    [Fact]
    public async Task APageWithNoViewsIsLeftOut()
    {
        var harness = new Harness(now: Noon, pages: [new("home", 0), new("gallery", 2)]);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.TopPages.ShouldBe([new RankedItemDto("gallery", 2, 100)]);
    }

    [Fact]
    public async Task NoPageViewsIsAnEmptyList()
    {
        var harness = new Harness(now: Noon);

        var result = await harness.Handler.HandleAsync(new VisitorStatsRequest(), TestContext.Current.CancellationToken);

        result.Value.TopPages.ShouldBeEmpty();
    }

    private sealed class Harness
    {
        public Harness(
            int pageViews = 0,
            DateTimeOffset? now = null,
            IReadOnlyList<TrendCount>? trend = null,
            IReadOnlyList<NamedCount>? pages = null)
        {
            Reader = Substitute.For<IVisitorStatsReader>();
            Reader.ReadPageViewsAsync(Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(pageViews));
            Reader.ReadTrendAsync(Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<StatsBucketKind>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(trend ?? []));
            Reader.ReadPagesAsync(Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(pages ?? []));
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
