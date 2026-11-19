using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Infrastructure.Analytics;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Analytics;

/// <summary>
/// ANL-08, D-57, D-68, RESEARCH A4: the page views, the trend and the page list are exact on SQL Server and come from the daily page counts
/// only. The daily read behind the CSV export keeps its visit figures until plan 12.1-15.
/// </summary>
public sealed class VisitorStatsReaderTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateOnly Cut = new(2025, 10, 15);
    private static readonly DateOnly Day = new(2026, 11, 10);

    [Fact]
    public async Task PageViewsAreSummedAcrossEveryPageAndOnlyForDaysInsideTheRange()
    {
        await database.ResetAsync();
        await SeedViewsAsync(Day.AddDays(-1), PageKeys.Home, 100);
        await SeedViewsAsync(Day, PageKeys.Home, 3);
        await SeedViewsAsync(Day, PageKeys.Gallery, 5);
        await SeedViewsAsync(Day.AddDays(1), PageKeys.Contact, 4);
        await SeedViewsAsync(Day.AddDays(2), PageKeys.Home, 100);

        var pageViews = await ReadPageViewsAsync(Day, Day.AddDays(1));

        pageViews.ShouldBe(12);
    }

    [Fact]
    public async Task ARangeWithNoRowsAnswersZeros()
    {
        await database.ResetAsync();

        (await ReadPageViewsAsync(Day, Day.AddDays(5))).ShouldBe(0);
        (await ReadPagesAsync(Day, Day.AddDays(5))).ShouldBeEmpty();
    }

    [Fact]
    public async Task ADayWithVisitsButNoDailyRowsAddsNoPageViews()
    {
        await database.ResetAsync();
        await SeedVisitAsync(1, Day);

        (await ReadPageViewsAsync(Day, Day)).ShouldBe(0);
    }

    [Fact]
    public async Task AOneDayRangeIsThatDayOnly()
    {
        await database.ResetAsync();
        await SeedViewsAsync(Day.AddDays(-1), PageKeys.Home, 5);
        await SeedViewsAsync(Day, PageKeys.Home, 7);
        await SeedViewsAsync(Day.AddDays(1), PageKeys.Home, 9);

        (await ReadPageViewsAsync(Day, Day)).ShouldBe(7);
    }

    [Fact]
    public async Task PageViewsFromThreeYearsBackAreReadLikeAnyOther()
    {
        await database.ResetAsync();
        var old = new DateOnly(2023, 11, 20);
        await SeedViewsAsync(old, PageKeys.Gallery, 9);

        (await ReadPageViewsAsync(new DateOnly(2023, 11, 15), new DateOnly(2023, 11, 30))).ShouldBe(9);
    }

    [Fact]
    public async Task ADayTrendHasEachDaysPageViewsAndOnlyDaysWithData()
    {
        await database.ResetAsync();
        await SeedViewsAsync(Day.AddDays(-1), PageKeys.Home, 100);
        await SeedViewsAsync(Day, PageKeys.Home, 3);
        await SeedViewsAsync(Day, PageKeys.Gallery, 5);
        await SeedViewsAsync(Day.AddDays(2), PageKeys.Home, 4);
        await SeedViewsAsync(Day.AddDays(3), PageKeys.Home, 100);

        var trend = await ReadTrendAsync(Day, Day.AddDays(2), StatsBucketKind.Day);

        trend.ShouldBe([new TrendCount(Day, 8), new TrendCount(Day.AddDays(2), 4)]);
    }

    [Fact]
    public async Task ATrendWithNoRowsIsEmpty()
    {
        await database.ResetAsync();

        var trend = await ReadTrendAsync(Day, Day.AddDays(29), StatsBucketKind.Day);

        trend.ShouldBeEmpty();
    }

    [Fact]
    public async Task AMonthTrendSumsPageViewsPerMonth()
    {
        await database.ResetAsync();
        await SeedViewsAsync(new DateOnly(2026, 10, 20), PageKeys.Home, 5);
        await SeedViewsAsync(Day, PageKeys.Home, 3);
        await SeedViewsAsync(Day.AddDays(5), PageKeys.Gallery, 4);

        var trend = await ReadTrendAsync(new DateOnly(2026, 10, 1), new DateOnly(2026, 11, 30), StatsBucketKind.Month);

        trend.ShouldBe([new TrendCount(new DateOnly(2026, 10, 1), 5), new TrendCount(new DateOnly(2026, 11, 1), 7)]);
    }

    [Fact]
    public async Task AMonthTrendReadsOnlyTheDaysOfAPartMonthInsideTheRange()
    {
        await database.ResetAsync();
        await SeedViewsAsync(Day, PageKeys.Home, 100);
        await SeedViewsAsync(Day.AddDays(5), PageKeys.Home, 4);

        var trend = await ReadTrendAsync(Day.AddDays(2), new DateOnly(2026, 11, 30), StatsBucketKind.Month);

        trend.ShouldBe([new TrendCount(new DateOnly(2026, 11, 1), 4)]);
    }

    [Fact]
    public async Task TopPagesSumEachPagesViewsOverTheRangeOnly()
    {
        await database.ResetAsync();
        await SeedViewsAsync(Day.AddDays(-1), PageKeys.Home, 100);
        await SeedViewsAsync(Day, PageKeys.Home, 3);
        await SeedViewsAsync(Day.AddDays(1), PageKeys.Home, 4);
        await SeedViewsAsync(Day, PageKeys.Gallery, 5);
        await SeedViewsAsync(Day.AddDays(2), PageKeys.Contact, 9);

        var pages = await ReadPagesAsync(Day, Day.AddDays(1));

        pages.OrderBy(static row => row.Name, StringComparer.Ordinal)
            .ShouldBe([new NamedCount(PageKeys.Gallery, 5), new NamedCount(PageKeys.Home, 7)]);
    }

    [Fact]
    public async Task TopPagesKeepPageViewsFromBeforeTheOldVisitCut()
    {
        await database.ResetAsync();
        await SeedViewsAsync(Cut.AddDays(-10), PageKeys.NotFound, 6);
        await SeedViewsAsync(Cut, PageKeys.NotFound, 1);

        var pages = await ReadPagesAsync(Cut.AddDays(-30), Cut);

        pages.ShouldBe([new NamedCount(PageKeys.NotFound, 7)]);
    }

    [Fact]
    public async Task EachDayHasItsPageViewsVisitsAndDistinctVisitorsAndOnlyDaysWithDataAreListed()
    {
        await database.ResetAsync();
        await SeedViewsAsync(Day, PageKeys.Home, 3);
        await SeedViewsAsync(Day, PageKeys.Gallery, 5);
        await SeedViewsAsync(Day.AddDays(2), PageKeys.Contact, 4);
        await SeedViewsAsync(Day.AddDays(3), PageKeys.Home, 100);
        await SeedVisitAsync(1, Day);
        await SeedVisitAsync(1, Day);
        await SeedVisitAsync(2, Day);
        await SeedVisitAsync(1, Day.AddDays(1));
        await SeedVisitAsync(9, Day.AddDays(-1));

        var days = await ReadDailyAsync(Day, Day.AddDays(2));

        days.ShouldBe(
        [
            new DailyCount(Day, 8, 3, 2),
            new DailyCount(Day.AddDays(1), 0, 1, 1),
            new DailyCount(Day.AddDays(2), 4, 0, 0),
        ]);
    }

    [Fact]
    public async Task VisitsAreReadOnlyFromTheCutDayOnWhilePageViewsAreReadForEveryDay()
    {
        await database.ResetAsync();
        await SeedViewsAsync(Cut.AddDays(-1), PageKeys.Home, 6);
        await SeedViewsAsync(Cut, PageKeys.Home, 2);
        await SeedVisitAsync(1, Cut.AddDays(-1));
        await SeedVisitAsync(2, Cut);

        var crossing = await ReadDailyAsync(Cut.AddDays(-2), Cut);
        var old = await ReadDailyAsync(Cut.AddDays(-2), Cut.AddDays(-1));

        crossing.ShouldBe([new DailyCount(Cut.AddDays(-1), 6, 0, 0), new DailyCount(Cut, 2, 1, 1)]);
        old.ShouldBe([new DailyCount(Cut.AddDays(-1), 6, 0, 0)]);
    }

    [Fact]
    public async Task ARangeWithNoDataListsNoDays()
    {
        await database.ResetAsync();

        (await ReadDailyAsync(Day, Day.AddDays(4))).ShouldBeEmpty();
    }

    private async Task<IReadOnlyList<DailyCount>> ReadDailyAsync(DateOnly from, DateOnly to)
    {
        await using var context = database.CreateContext();
        return await new VisitorStatsReader(context).ReadDailyAsync(from, to, Cut, TestContext.Current.CancellationToken);
    }

    private async Task<IReadOnlyList<NamedCount>> ReadPagesAsync(DateOnly from, DateOnly to)
    {
        await using var context = database.CreateContext();
        return await new VisitorStatsReader(context).ReadPagesAsync(from, to, TestContext.Current.CancellationToken);
    }

    private async Task<IReadOnlyList<TrendCount>> ReadTrendAsync(DateOnly from, DateOnly to, StatsBucketKind bucket)
    {
        await using var context = database.CreateContext();
        return await new VisitorStatsReader(context).ReadTrendAsync(from, to, bucket, TestContext.Current.CancellationToken);
    }

    private async Task<int> ReadPageViewsAsync(DateOnly from, DateOnly to)
    {
        await using var context = database.CreateContext();
        return await new VisitorStatsReader(context).ReadPageViewsAsync(from, to, TestContext.Current.CancellationToken);
    }

    private async Task SeedViewsAsync(DateOnly day, string pageKey, int views)
    {
        await using var context = database.CreateContext();
        context.DailyPageCounts.Add(DailyPageCount.First(day, pageKey));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        await context.DailyPageCounts
            .Where(row => row.BusinessDay == day && row.PageKey == pageKey)
            .ExecuteUpdateAsync(set => set.SetProperty(row => row.Views, views), TestContext.Current.CancellationToken);
    }

    private async Task SeedVisitAsync(byte visitor, DateOnly day)
    {
        await using var context = database.CreateContext();
        var startedAt = new DateTimeOffset(day.ToDateTime(new TimeOnly(10, 0)), TimeSpan.FromHours(8)).ToUniversalTime();
        context.AnalyticsVisits.Add(
            AnalyticsVisit.Start(Enumerable.Repeat(visitor, 32).ToArray(), day, startedAt, ReferrerName.Direct, DeviceKind.Phone, "Chrome", "Android", null));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }
}
