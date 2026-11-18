using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Infrastructure.Analytics;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Analytics;

/// <summary>
/// ANL-08, D-27, D-33, RESEARCH A4: the totals are exact on SQL Server. Page views are summed from the daily counts for every page, visits
/// are counted rows, unique visitors are a distinct count of the visitor hash, and visits are read only from the cut day on.
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

        var totals = await ReadAsync(Day, Day.AddDays(1));

        totals.PageViews.ShouldBe(12);
    }

    [Fact]
    public async Task VisitsAreCountedAsRowsAndUniqueVisitorsAsDistinctHashes()
    {
        await database.ResetAsync();
        await SeedVisitAsync(1, Day);
        await SeedVisitAsync(1, Day.AddDays(1));
        await SeedVisitAsync(1, Day.AddDays(1));
        await SeedVisitAsync(2, Day);
        await SeedVisitAsync(3, Day.AddDays(-1));
        await SeedVisitAsync(4, Day.AddDays(2));

        var totals = await ReadAsync(Day, Day.AddDays(1));

        totals.Visits.ShouldBe(4);
        totals.UniqueVisitors.ShouldBe(2);
    }

    [Fact]
    public async Task ARangeWithNoRowsAnswersZeros()
    {
        await database.ResetAsync();

        var totals = await ReadAsync(Day, Day.AddDays(5));

        totals.ShouldBe(new VisitorTotals(0, 0, 0));
    }

    [Fact]
    public async Task ADayWithVisitsButNoDailyRowsStillCountsVisitsAndAddsNoPageViews()
    {
        await database.ResetAsync();
        await SeedVisitAsync(1, Day);

        var totals = await ReadAsync(Day, Day);

        totals.ShouldBe(new VisitorTotals(1, 1, 0));
    }

    [Fact]
    public async Task AOneDayRangeIsThatDayOnly()
    {
        await database.ResetAsync();
        await SeedVisitAsync(1, Day.AddDays(-1));
        await SeedVisitAsync(2, Day);
        await SeedVisitAsync(3, Day.AddDays(1));
        await SeedViewsAsync(Day, PageKeys.Home, 7);

        var totals = await ReadAsync(Day, Day);

        totals.ShouldBe(new VisitorTotals(1, 1, 7));
    }

    [Fact]
    public async Task VisitsAreReadFromTheCutDayOnAndTheCutDayItselfCounts()
    {
        await database.ResetAsync();
        await SeedVisitAsync(1, Cut.AddDays(-1));
        await SeedVisitAsync(2, Cut);
        await SeedVisitAsync(3, Cut.AddDays(1));
        await SeedViewsAsync(Cut.AddDays(-1), PageKeys.Home, 10);
        await SeedViewsAsync(Cut, PageKeys.Home, 20);

        var totals = await ReadAsync(Cut.AddDays(-5), Cut.AddDays(1));

        totals.Visits.ShouldBe(2);
        totals.UniqueVisitors.ShouldBe(2);
        totals.PageViews.ShouldBe(30);
    }

    [Fact]
    public async Task ARangeEndingTheDayBeforeTheCutCountsPageViewsAndNoVisits()
    {
        await database.ResetAsync();
        await SeedVisitAsync(1, Cut.AddDays(-1));
        await SeedViewsAsync(Cut.AddDays(-1), PageKeys.Gallery, 9);

        var totals = await ReadAsync(Cut.AddDays(-30), Cut.AddDays(-1));

        totals.ShouldBe(new VisitorTotals(0, 0, 9));
    }

    [Fact]
    public async Task ADayTrendHasEachDaysPageViewsAndDistinctVisitorsAndOnlyDaysWithData()
    {
        await database.ResetAsync();
        await SeedViewsAsync(Day.AddDays(-1), PageKeys.Home, 100);
        await SeedViewsAsync(Day, PageKeys.Home, 3);
        await SeedViewsAsync(Day, PageKeys.Gallery, 5);
        await SeedViewsAsync(Day.AddDays(2), PageKeys.Home, 4);
        await SeedVisitAsync(1, Day);
        await SeedVisitAsync(1, Day);
        await SeedVisitAsync(2, Day);
        await SeedVisitAsync(1, Day.AddDays(1));
        await SeedVisitAsync(4, Day.AddDays(3));

        var trend = await ReadTrendAsync(Day, Day.AddDays(2), StatsBucketKind.Day);

        trend.ShouldBe([new TrendCount(Day, 8, 2), new TrendCount(Day.AddDays(1), 0, 1), new TrendCount(Day.AddDays(2), 4, 0)]);
    }

    [Fact]
    public async Task ADayTrendCountsVisitorsOnlyFromTheCutDayOnAndKeepsOlderPageViews()
    {
        await database.ResetAsync();
        await SeedVisitAsync(1, Cut.AddDays(-1));
        await SeedViewsAsync(Cut.AddDays(-1), PageKeys.Home, 10);
        await SeedVisitAsync(2, Cut);

        var trend = await ReadTrendAsync(Cut.AddDays(-1), Cut, StatsBucketKind.Day);

        trend.ShouldBe([new TrendCount(Cut.AddDays(-1), 10, 0), new TrendCount(Cut, 0, 1)]);
    }

    [Fact]
    public async Task ATrendWithNoRowsIsEmpty()
    {
        await database.ResetAsync();

        var trend = await ReadTrendAsync(Day, Day.AddDays(29), StatsBucketKind.Day);

        trend.ShouldBeEmpty();
    }

    private async Task<IReadOnlyList<TrendCount>> ReadTrendAsync(DateOnly from, DateOnly to, StatsBucketKind bucket)
    {
        await using var context = database.CreateContext();
        return await new VisitorStatsReader(context).ReadTrendAsync(from, to, Cut, bucket, TestContext.Current.CancellationToken);
    }

    private async Task<VisitorTotals> ReadAsync(DateOnly from, DateOnly to)
    {
        await using var context = database.CreateContext();
        return await new VisitorStatsReader(context).ReadTotalsAsync(from, to, Cut, TestContext.Current.CancellationToken);
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
