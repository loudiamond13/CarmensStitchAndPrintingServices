using Csps.Domain.Analytics;
using Csps.Infrastructure.Analytics;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Analytics;

/// <summary>ANL-06: the counter makes a row on the first view of a page on a day and adds one to it after that, one row per day and page.</summary>
public sealed class PageViewCountsTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateOnly Day = new(2026, 11, 17);

    [Fact]
    public async Task TheFirstViewOfAPageOnADayMakesOneRowWithOneView()
    {
        await database.ResetAsync();

        await IncrementAsync(Day, PageKeys.Gallery);

        var row = (await ReadAsync()).ShouldHaveSingleItem();
        row.BusinessDay.ShouldBe(Day);
        row.PageKey.ShouldBe("gallery");
        row.Views.ShouldBe(1);
    }

    [Fact]
    public async Task EachLaterViewAddsOneToTheSameRow()
    {
        await database.ResetAsync();

        await IncrementAsync(Day, PageKeys.Home);
        await IncrementAsync(Day, PageKeys.Home);
        await IncrementAsync(Day, PageKeys.Home);

        (await ReadAsync()).ShouldHaveSingleItem().Views.ShouldBe(3);
    }

    [Fact]
    public async Task AnotherPageOrAnotherDayHasItsOwnRow()
    {
        await database.ResetAsync();

        await IncrementAsync(Day, PageKeys.Home);
        await IncrementAsync(Day, PageKeys.Products);
        await IncrementAsync(Day.AddDays(1), PageKeys.Home);

        var rows = await ReadAsync();
        rows.Count.ShouldBe(3);
        rows.ShouldAllBe(row => row.Views == 1);
    }

    [Fact]
    public async Task TenParallelFirstViewsOfOnePageOnOneDayLeaveOneRowWithTenViews()
    {
        await database.ResetAsync();

        await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => Task.Run(() => IncrementAsync(Day, PageKeys.Home), TestContext.Current.CancellationToken)));

        var row = (await ReadAsync()).ShouldHaveSingleItem();
        row.PageKey.ShouldBe("home");
        row.Views.ShouldBe(10);
    }

    [Fact]
    public async Task ParallelViewsOnTopOfAnExistingRowAreAllCounted()
    {
        await database.ResetAsync();
        await IncrementAsync(Day, PageKeys.Contact);

        await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => Task.Run(() => IncrementAsync(Day, PageKeys.Contact), TestContext.Current.CancellationToken)));

        (await ReadAsync()).ShouldHaveSingleItem().Views.ShouldBe(21);
    }

    [Fact]
    public async Task ParallelFirstViewsOfSeveralPagesKeepOneRowEach()
    {
        await database.ResetAsync();
        string[] keys = [PageKeys.Home, PageKeys.Products, PageKeys.Gallery];

        await Task.WhenAll(Enumerable.Range(0, 30).Select(index => Task.Run(() => IncrementAsync(Day, keys[index % keys.Length]), TestContext.Current.CancellationToken)));

        var rows = await ReadAsync();
        rows.Count.ShouldBe(3);
        rows.ShouldAllBe(row => row.Views == 10);
    }

    private async Task IncrementAsync(DateOnly day, string pageKey)
    {
        await using var context = database.CreateContext();
        await new PageViewCounts(context).IncrementAsync(day, pageKey, TestContext.Current.CancellationToken);
    }

    private async Task<List<DailyPageCount>> ReadAsync()
    {
        await using var context = database.CreateContext();
        return await context.DailyPageCounts.AsNoTracking().OrderBy(row => row.BusinessDay).ThenBy(row => row.PageKey).ToListAsync(TestContext.Current.CancellationToken);
    }
}
