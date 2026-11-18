using Csps.Domain.Analytics;
using Csps.Infrastructure.Analytics;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Analytics;

/// <summary>
/// ANL-05, D-07: the visit store finds the current visit, counts page views atomically and cascades deletes, and the salt store makes one random
/// salt per business day even when many requests ask for the first one at once.
/// </summary>
public sealed class AnalyticsVisitsTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateOnly Day = new(2026, 11, 17);
    private static readonly DateTimeOffset Start = new(2026, 11, 17, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AStartedVisitIsFoundWhileItWasLastSeenAfterTheCutAndNotAtOrBeforeIt()
    {
        await database.ResetAsync();
        var hash = Hash(1);
        var visit = NewVisit(hash, Start);
        await StartAsync(visit);

        (await FindAsync(hash, Start.AddMinutes(-1))).ShouldBe(visit.Id);
        (await FindAsync(hash, Start)).ShouldBeNull();
        (await FindAsync(hash, Start.AddMinutes(1))).ShouldBeNull();
    }

    [Fact]
    public async Task AnotherVisitorsVisitIsNotFound()
    {
        await database.ResetAsync();
        await StartAsync(NewVisit(Hash(1), Start));

        (await FindAsync(Hash(2), Start.AddMinutes(-30))).ShouldBeNull();
    }

    [Fact]
    public async Task TheNewestVisitIsFoundWhenTheVisitorHasTwoInsideTheWindow()
    {
        await database.ResetAsync();
        var older = NewVisit(Hash(1), Start);
        var newer = NewVisit(Hash(1), Start.AddMinutes(10));
        await StartAsync(older);
        await StartAsync(newer);

        (await FindAsync(Hash(1), Start.AddMinutes(-30))).ShouldBe(newer.Id);
    }

    [Fact]
    public async Task ATouchAddsOnePageViewAndMovesTheLastSeenTimeForward()
    {
        await database.ResetAsync();
        var visit = NewVisit(Hash(1), Start);
        await StartAsync(visit);

        await TouchAsync(visit.Id, Start.AddMinutes(5));

        var row = await ReadVisitAsync(visit.Id);
        row.PageViews.ShouldBe(2);
        row.LastSeenAtUtc.ShouldBe(Start.AddMinutes(5));
        row.StartedAtUtc.ShouldBe(Start);
    }

    [Fact]
    public async Task ATouchWithAnOlderTimeAddsTheViewButNeverMovesTheLastSeenTimeBack()
    {
        await database.ResetAsync();
        var visit = NewVisit(Hash(1), Start);
        await StartAsync(visit);
        await TouchAsync(visit.Id, Start.AddMinutes(9));

        await TouchAsync(visit.Id, Start.AddMinutes(4));

        var row = await ReadVisitAsync(visit.Id);
        row.PageViews.ShouldBe(3);
        row.LastSeenAtUtc.ShouldBe(Start.AddMinutes(9));
    }

    [Fact]
    public async Task TwentyParallelTouchesAreAllCounted()
    {
        await database.ResetAsync();
        var visit = NewVisit(Hash(1), Start);
        await StartAsync(visit);

        await Task.WhenAll(Enumerable.Range(0, 20).Select(index => Task.Run(() => TouchAsync(visit.Id, Start.AddSeconds(index)), TestContext.Current.CancellationToken)));

        var row = await ReadVisitAsync(visit.Id);
        row.PageViews.ShouldBe(21);
        row.LastSeenAtUtc.ShouldBe(Start.AddSeconds(19));
    }

    [Fact]
    public async Task APageViewAndSamplesAreSavedAndGoWhenTheVisitIsDeleted()
    {
        await database.ResetAsync();
        var visit = NewVisit(Hash(1), Start);
        await StartAsync(visit);
        await using (var context = database.CreateContext())
        {
            var store = new AnalyticsVisits(context);
            await store.AddPageViewAsync(AnalyticsPageView.Of(visit.Id, Day, Start, PageKeys.Gallery), TestContext.Current.CancellationToken);
            await store.AddSamplesAsync(
                [
                    AnalyticsVitalSample.Of(visit.Id, Day, VitalMetric.Lcp, 2100m, PageKeys.Gallery),
                    AnalyticsVitalSample.Of(visit.Id, Day, VitalMetric.Cls, 0.04m, PageKeys.Gallery),
                ],
                TestContext.Current.CancellationToken);
        }

        await using (var check = database.CreateContext())
        {
            (await check.AnalyticsPageViews.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
            (await check.AnalyticsVitalSamples.OrderBy(sample => sample.Metric).Select(sample => sample.Value).ToListAsync(TestContext.Current.CancellationToken)).ShouldBe([2100m, 0.04m]);
            await check.AnalyticsVisits.Where(row => row.Id == visit.Id).ExecuteDeleteAsync(TestContext.Current.CancellationToken);
            (await check.AnalyticsPageViews.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
            (await check.AnalyticsVitalSamples.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        }
    }

    [Fact]
    public async Task DeletingAVisitorRemovesItsVisitsPageViewsAndSamplesAndLeavesEveryoneElse()
    {
        await database.ResetAsync();
        var mine = NewVisit(Hash(1), Start);
        var myOther = NewVisit(Hash(1), Start.AddHours(3));
        var theirs = NewVisit(Hash(2), Start);
        foreach (var visit in new[] { mine, myOther, theirs })
        {
            await StartAsync(visit);
            await AddRowsAsync(visit);
        }

        await using (var context = database.CreateContext())
        {
            await new AnalyticsVisits(context).DeleteForVisitorAsync(Hash(1), TestContext.Current.CancellationToken);
        }

        await using var check = database.CreateContext();
        (await check.AnalyticsVisits.Select(row => row.Id).ToListAsync(TestContext.Current.CancellationToken)).ShouldBe([theirs.Id]);
        (await check.AnalyticsPageViews.Select(row => row.VisitId).ToListAsync(TestContext.Current.CancellationToken)).ShouldBe([theirs.Id]);
        (await check.AnalyticsVitalSamples.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task DeletingAVisitorWithNoRowsChangesNothingAndDoesNotFail()
    {
        await database.ResetAsync();
        var theirs = NewVisit(Hash(2), Start);
        await StartAsync(theirs);

        await using (var context = database.CreateContext())
        {
            await new AnalyticsVisits(context).DeleteForVisitorAsync(Hash(1), TestContext.Current.CancellationToken);
        }

        await using var check = database.CreateContext();
        (await check.AnalyticsVisits.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task ParallelFirstViewsOfOneVisitorStartOneVisit()
    {
        await database.ResetAsync();
        var since = Start.AddMinutes(-30);
        var results = await Task.WhenAll(
            Enumerable.Range(0, 3 * 8).Select(async index =>
            {
                await Task.Yield();
                var hash = Hash((byte)(index % 8));
                await using var context = database.CreateContext();
                var store = new AnalyticsVisits(context);
                return (Hash: hash[0], Result: await store.StartUnlessCurrentAsync(NewVisit(hash, Start), since, TestContext.Current.CancellationToken));
            }));

        await using var check = database.CreateContext();
        (await check.AnalyticsVisits.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(8);
        foreach (var group in results.GroupBy(result => result.Hash))
        {
            group.Count(result => result.Result.Started).ShouldBe(1);
            group.Select(result => result.Result.VisitId).Distinct().Count().ShouldBe(1);
        }
    }

    [Fact]
    public async Task AFirstViewJoinsTheCurrentVisitInsteadOfStartingAnother()
    {
        await database.ResetAsync();
        var current = NewVisit(Hash(1), Start);
        await StartAsync(current);
        await using var context = database.CreateContext();

        var result = await new AnalyticsVisits(context).StartUnlessCurrentAsync(NewVisit(Hash(1), Start.AddMinutes(5)), Start.AddMinutes(-25), TestContext.Current.CancellationToken);

        result.Started.ShouldBeFalse();
        result.VisitId.ShouldBe(current.Id);
        await using var check = database.CreateContext();
        (await check.AnalyticsVisits.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task AFirstViewStartsAVisitWhenTheOldOneIsOutsideTheWindow()
    {
        await database.ResetAsync();
        await StartAsync(NewVisit(Hash(1), Start));
        await using var context = database.CreateContext();
        var fresh = NewVisit(Hash(1), Start.AddMinutes(45));

        var result = await new AnalyticsVisits(context).StartUnlessCurrentAsync(fresh, Start.AddMinutes(15), TestContext.Current.CancellationToken);

        result.Started.ShouldBeTrue();
        result.VisitId.ShouldBe(fresh.Id);
    }

    [Fact]
    public async Task APageViewForAVisitClearedAMomentAgoIsDroppedWithoutAnError()
    {
        await database.ResetAsync();
        var visit = NewVisit(Hash(1), Start);
        await StartAsync(visit);
        await using var context = database.CreateContext();
        var store = new AnalyticsVisits(context);
        await store.DeleteForVisitorAsync(Hash(1), TestContext.Current.CancellationToken);

        await store.AddPageViewAsync(AnalyticsPageView.Of(visit.Id, Day, Start, PageKeys.Gallery), TestContext.Current.CancellationToken);

        await using var check = database.CreateContext();
        (await check.AnalyticsPageViews.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task SamplesForAVisitClearedAMomentAgoAreDroppedWithoutAnError()
    {
        await database.ResetAsync();
        var visit = NewVisit(Hash(1), Start);
        await StartAsync(visit);
        await using var context = database.CreateContext();
        var store = new AnalyticsVisits(context);
        await store.DeleteForVisitorAsync(Hash(1), TestContext.Current.CancellationToken);

        await store.AddSamplesAsync([AnalyticsVitalSample.Of(visit.Id, Day, VitalMetric.Lcp, 2100m, PageKeys.Gallery)], TestContext.Current.CancellationToken);

        await using var check = database.CreateContext();
        (await check.AnalyticsVitalSamples.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task NoSamplesWritesNothingAndDoesNotFail()
    {
        await database.ResetAsync();
        await using var context = database.CreateContext();

        await new AnalyticsVisits(context).AddSamplesAsync([], TestContext.Current.CancellationToken);

        (await context.AnalyticsVitalSamples.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task TheFirstCallForADayMakesOneRandom32ByteSaltAndLaterCallsGetTheSame()
    {
        await database.ResetAsync();

        var first = await SaltAsync(Day, new AnalyticsSaltCache());
        var second = await SaltAsync(Day, new AnalyticsSaltCache());

        first.Length.ShouldBe(32);
        first.Any(value => value != 0).ShouldBeTrue();
        second.ShouldBe(first);
        var row = (await ReadSaltsAsync()).ShouldHaveSingleItem();
        row.BusinessDay.ShouldBe(Day);
        row.Salt.ShouldBe(first);
    }

    [Fact]
    public async Task AnotherDayGetsAnotherSaltRow()
    {
        await database.ResetAsync();
        var cache = new AnalyticsSaltCache();

        var today = await SaltAsync(Day, cache);
        var tomorrow = await SaltAsync(Day.AddDays(1), cache);

        tomorrow.ShouldNotBe(today);
        (await ReadSaltsAsync()).Count.ShouldBe(2);
    }

    [Fact]
    public async Task TenParallelRequestsForTheFirstSaltOfADayLeaveOneRowAndAllGetThatSalt()
    {
        await database.ResetAsync();

        var salts = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => Task.Run(() => SaltAsync(Day, new AnalyticsSaltCache()), TestContext.Current.CancellationToken)));

        var row = (await ReadSaltsAsync()).ShouldHaveSingleItem();
        salts.ShouldAllBe(salt => salt.SequenceEqual(row.Salt));
    }

    [Fact]
    public async Task TenParallelRequestsSharingOneCacheAlsoLeaveOneRow()
    {
        await database.ResetAsync();
        var cache = new AnalyticsSaltCache();

        var salts = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => Task.Run(() => SaltAsync(Day, cache), TestContext.Current.CancellationToken)));

        var row = (await ReadSaltsAsync()).ShouldHaveSingleItem();
        salts.ShouldAllBe(salt => salt.SequenceEqual(row.Salt));
    }

    [Fact]
    public async Task ACachedSaltIsReturnedWithoutAnotherRead()
    {
        await database.ResetAsync();
        var cache = new AnalyticsSaltCache();
        var first = await SaltAsync(Day, cache);
        await using (var context = database.CreateContext())
        {
            await context.AnalyticsSalts.ExecuteDeleteAsync(TestContext.Current.CancellationToken);
        }

        var second = await SaltAsync(Day, cache);

        second.ShouldBe(first);
    }

    [Fact]
    public void TheCacheKeepsOnlyTodayAndYesterdayLikeThePurgeJobDoes()
    {
        var cache = new AnalyticsSaltCache();
        cache.Set(Day, Hash(1));
        cache.Set(Day.AddDays(AnalyticsRetention.SaltDays - 1), Hash(2));
        cache.TryGet(Day, out _).ShouldBeTrue("yesterday is kept");

        cache.Set(Day.AddDays(AnalyticsRetention.SaltDays), Hash(3));

        cache.TryGet(Day, out _).ShouldBeFalse("the purge job deletes this day, so the process must not hold it");
        cache.TryGet(Day.AddDays(AnalyticsRetention.SaltDays - 1), out var kept).ShouldBeTrue();
        kept.ShouldBe(Hash(2));
    }

    [Fact]
    public void TheCacheKeepsTheFirstSaltWhenTwoCallersAddTheSameDay()
    {
        var cache = new AnalyticsSaltCache();

        var first = cache.Set(Day, Hash(1));
        var second = cache.Set(Day, Hash(2));

        first.ShouldBe(Hash(1));
        second.ShouldBe(Hash(1));
    }

    private static AnalyticsVisit NewVisit(byte[] hash, DateTimeOffset at) =>
        AnalyticsVisit.Start(hash, Day, at, ReferrerName.Direct, DeviceKind.Computer, "Chrome", "Windows", null);

    private async Task AddRowsAsync(AnalyticsVisit visit)
    {
        await using var context = database.CreateContext();
        var store = new AnalyticsVisits(context);
        await store.AddPageViewAsync(AnalyticsPageView.Of(visit.Id, Day, visit.StartedAtUtc, PageKeys.Gallery), TestContext.Current.CancellationToken);
        await store.AddSamplesAsync([AnalyticsVitalSample.Of(visit.Id, Day, VitalMetric.Lcp, 2100m, PageKeys.Gallery)], TestContext.Current.CancellationToken);
    }

    private static byte[] Hash(byte fill) => Enumerable.Repeat(fill, 32).ToArray();

    private async Task StartAsync(AnalyticsVisit visit)
    {
        await using var context = database.CreateContext();
        await new AnalyticsVisits(context).StartAsync(visit, TestContext.Current.CancellationToken);
    }

    private async Task<Guid?> FindAsync(byte[] hash, DateTimeOffset since)
    {
        await using var context = database.CreateContext();
        return await new AnalyticsVisits(context).FindCurrentAsync(hash, since, TestContext.Current.CancellationToken);
    }

    private async Task TouchAsync(Guid visitId, DateTimeOffset at)
    {
        await using var context = database.CreateContext();
        await new AnalyticsVisits(context).TouchAsync(visitId, at, TestContext.Current.CancellationToken);
    }

    private async Task<AnalyticsVisit> ReadVisitAsync(Guid id)
    {
        await using var context = database.CreateContext();
        return await context.AnalyticsVisits.AsNoTracking().SingleAsync(row => row.Id == id, TestContext.Current.CancellationToken);
    }

    private async Task<byte[]> SaltAsync(DateOnly day, AnalyticsSaltCache cache)
    {
        await using var context = database.CreateContext();
        return await new AnalyticsSalts(context, cache).ForDayAsync(day, TestContext.Current.CancellationToken);
    }

    private async Task<List<AnalyticsSalt>> ReadSaltsAsync()
    {
        await using var context = database.CreateContext();
        return await context.AnalyticsSalts.AsNoTracking().OrderBy(row => row.BusinessDay).ToListAsync(TestContext.Current.CancellationToken);
    }
}
