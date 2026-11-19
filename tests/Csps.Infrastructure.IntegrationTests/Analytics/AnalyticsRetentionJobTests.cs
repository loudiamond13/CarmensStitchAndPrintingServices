using System.Data.Common;
using Csps.Application.Maintenance;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Domain.Time;
using Csps.Infrastructure.Analytics;
using Csps.Infrastructure.Maintenance;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Analytics;

/// <summary>
/// ANL-09, D-03 to D-05, D-07: the retention job rolls each closed business day into daily referrer and device totals before any raw row ages
/// out, then removes raw visits, consent records, old daily totals and old address salts at their cut dates, one plain line per rule.
/// </summary>
public sealed class AnalyticsRetentionJobTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string RolledUpLabel = "Visitor days rolled up";
    private const string RawLabel = "Old visit records removed";
    private const string ConsentLabel = "Old cookie choices removed";
    private const string DailyLabel = "Old daily visitor totals removed";
    private const string SaltLabel = "Old address salts removed";
    private const string JobName = "analytics-retention";

    // 2026-11-16 12:00 in Manila.
    private static readonly DateTimeOffset Now = new(2026, 11, 16, 4, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task ClosedDaysAreRolledIntoReferrerAndDeviceTotalsAndTodayIsNeverTouched()
    {
        await database.ResetAsync();
        var day = new DateOnly(2026, 11, 14);
        await AddVisitAsync(day, "Facebook", DeviceKind.Phone, "Chrome");
        await AddVisitAsync(day, "Facebook", DeviceKind.Phone, "Safari");
        await AddVisitAsync(day, ReferrerName.Direct, DeviceKind.Computer, "Chrome");
        await AddVisitAsync(new DateOnly(2026, 11, 16), "Facebook", DeviceKind.Phone, "Chrome");

        var report = await RunAsync(new FakeTimeProvider(Now));

        Line(report, RolledUpLabel).Value.ShouldBe(1);
        Line(report, RolledUpLabel).Failed.ShouldBeFalse();
        report.More.ShouldBeFalse();
        (await ReadReferrersAsync()).ShouldBe(
            [(day, "Direct", 1), (day, "Facebook", 2)], ignoreOrder: true);
        (await ReadDevicesAsync()).ShouldBe(
            [
                (day, DeviceDimension.Device, "Computer", 1),
                (day, DeviceDimension.Device, "Phone", 2),
                (day, DeviceDimension.Browser, "Chrome", 2),
                (day, DeviceDimension.Browser, "Safari", 1),
            ],
            ignoreOrder: true);
    }

    [Fact]
    public async Task TheLastRolledDayIsSavedAsYesterday()
    {
        await database.ResetAsync();
        await AddVisitAsync(new DateOnly(2026, 11, 14), "Facebook", DeviceKind.Phone, "Chrome");

        await RunAsync(new FakeTimeProvider(Now));

        (await ReadCursorAsync()).ShouldBe("2026-11-15");
    }

    [Fact]
    public async Task RunningTwiceGivesTheSameRowsAndTheSecondRunRollsNothing()
    {
        await database.ResetAsync();
        await AddVisitAsync(new DateOnly(2026, 11, 14), "Facebook", DeviceKind.Phone, "Chrome");
        await RunAsync(new FakeTimeProvider(Now));
        var referrers = await ReadReferrersAsync();
        var devices = await ReadDevicesAsync();

        var report = await RunAsync(new FakeTimeProvider(Now));

        Line(report, RolledUpLabel).Value.ShouldBe(0);
        (await ReadReferrersAsync()).ShouldBe(referrers);
        (await ReadDevicesAsync()).ShouldBe(devices);
    }

    [Fact]
    public async Task ARetryAfterACrashReplacesTheDaysRowsInsteadOfAddingToThem()
    {
        await database.ResetAsync();
        var day = new DateOnly(2026, 11, 14);
        await AddVisitAsync(day, "Facebook", DeviceKind.Phone, "Chrome");
        await RunAsync(new FakeTimeProvider(Now));
        await using (var context = database.CreateContext())
        {
            await new MaintenanceCursors(context, TimeProvider.System).ClearAsync(JobName, TestContext.Current.CancellationToken);
        }

        var report = await RunAsync(new FakeTimeProvider(Now));

        Line(report, RolledUpLabel).Value.ShouldBe(1);
        (await ReadReferrersAsync()).ShouldBe([(day, "Facebook", 1)]);
        (await ReadDevicesAsync()).Count.ShouldBe(2);
    }

    [Fact]
    public async Task ACursorSetBackRollsTheDayAgainAndCountsEveryVisitOnce()
    {
        await database.ResetAsync();
        var day = new DateOnly(2026, 11, 14);
        await AddVisitAsync(day, "Facebook", DeviceKind.Phone, "Chrome");
        await RunAsync(new FakeTimeProvider(Now));
        await AddVisitAsync(day, "Facebook", DeviceKind.Phone, "Chrome");
        await using (var context = database.CreateContext())
        {
            await new MaintenanceCursors(context, TimeProvider.System).SaveAsync(JobName, "2026-11-13", TestContext.Current.CancellationToken);
        }

        await RunAsync(new FakeTimeProvider(Now));

        (await ReadReferrersAsync()).ShouldBe([(day, "Facebook", 2)]);
    }

    [Fact]
    public async Task ADayEndingAtMonthEndAndTheNextDayAreRolledAsTwoDays()
    {
        await database.ResetAsync();
        await AddVisitAsync(new DateOnly(2026, 10, 31), "Facebook", DeviceKind.Phone, "Chrome");
        await AddVisitAsync(new DateOnly(2026, 11, 1), ReferrerName.Direct, DeviceKind.Computer, "Edge");

        var report = await RunAsync(new FakeTimeProvider(new DateTimeOffset(2026, 11, 3, 4, 0, 0, TimeSpan.Zero)));

        Line(report, RolledUpLabel).Value.ShouldBe(2);
        (await ReadReferrersAsync()).ShouldBe(
            [(new DateOnly(2026, 10, 31), "Facebook", 1), (new DateOnly(2026, 11, 1), "Direct", 1)], ignoreOrder: true);
        (await ReadCursorAsync()).ShouldBe("2026-11-02");
    }

    [Fact]
    public async Task ALeapDayIsRolledAsItsOwnDay()
    {
        await database.ResetAsync();
        await AddVisitAsync(new DateOnly(2028, 2, 29), "Facebook", DeviceKind.Phone, "Chrome");
        await AddVisitAsync(new DateOnly(2028, 3, 1), "Facebook", DeviceKind.Phone, "Chrome");

        await RunAsync(new FakeTimeProvider(new DateTimeOffset(2028, 3, 2, 4, 0, 0, TimeSpan.Zero)));

        (await ReadReferrersAsync()).ShouldBe(
            [(new DateOnly(2028, 2, 29), "Facebook", 1), (new DateOnly(2028, 3, 1), "Facebook", 1)], ignoreOrder: true);
        (await ReadCursorAsync()).ShouldBe("2028-03-01");
    }

    [Fact]
    public async Task ADayStaysOpenUntilManilaMidnightPasses()
    {
        await database.ResetAsync();
        var day = new DateOnly(2026, 11, 15);
        await AddVisitAsync(day, "Facebook", DeviceKind.Phone, "Chrome");

        // 23:59 in Manila on the 15th: the 15th is still today.
        var before = await RunAsync(new FakeTimeProvider(new DateTimeOffset(2026, 11, 15, 15, 59, 0, TimeSpan.Zero)));
        Line(before, RolledUpLabel).Value.ShouldBe(0);
        (await ReadReferrersAsync()).ShouldBeEmpty();

        // 00:00 in Manila on the 16th: the 15th is closed.
        var after = await RunAsync(new FakeTimeProvider(new DateTimeOffset(2026, 11, 15, 16, 0, 0, TimeSpan.Zero)));
        Line(after, RolledUpLabel).Value.ShouldBe(1);
        (await ReadReferrersAsync()).ShouldBe([(day, "Facebook", 1)]);
    }

    [Fact]
    public async Task ASpentBudgetAfterTheFirstDayStopsWithMoreAndTheNextRunFinishes()
    {
        await database.ResetAsync();
        await AddVisitAsync(new DateOnly(2026, 11, 12), "Facebook", DeviceKind.Phone, "Chrome");
        await AddVisitAsync(new DateOnly(2026, 11, 13), "Facebook", DeviceKind.Phone, "Chrome");
        await AddVisitAsync(new DateOnly(2026, 11, 14), "Facebook", DeviceKind.Phone, "Chrome");
        var clock = new FakeTimeProvider(Now);

        var first = await RunAsync(clock, new SpendBudgetAfterFirst(clock, MaintenanceBudget.DefaultDuration, "INSERT INTO [DailyReferrerCounts]"), new MaintenanceBudget(clock));

        Line(first, RolledUpLabel).Value.ShouldBe(1);
        first.More.ShouldBeTrue();
        (await ReadCursorAsync()).ShouldBe("2026-11-12");

        var second = await RunAsync(new FakeTimeProvider(Now));

        Line(second, RolledUpLabel).Value.ShouldBe(2);
        second.More.ShouldBeFalse();
        (await ReadCursorAsync()).ShouldBe("2026-11-15");
        (await ReadReferrersAsync()).Count.ShouldBe(3);
    }

    [Fact]
    public async Task ADatabaseFailureWhileRollingUpIsThatRulesFailedLineAndNeverThrows()
    {
        await database.ResetAsync();
        await AddVisitAsync(new DateOnly(2026, 11, 14), "Facebook", DeviceKind.Phone, "Chrome");

        var report = await RunAsync(new FakeTimeProvider(Now), new FailCommandsOn("DailyReferrerCounts"));

        var line = Line(report, RolledUpLabel);
        line.Failed.ShouldBeTrue();
        line.Value.ShouldBeNull();
        line.Text.ShouldBe("The visitor days could not be rolled up.");
        (await ReadReferrersAsync()).ShouldBeEmpty();
        (await ReadCursorAsync()).ShouldBeNull();
    }

    [Fact]
    public async Task AVisitThirteenMonthsOldGoesAndOneAtTheCutDateStaysAfterTheirDayIsRolledUp()
    {
        await database.ResetAsync();
        var gone = new DateOnly(2025, 10, 14);
        var kept = new DateOnly(2025, 10, 15);
        await AddVisitAsync(gone, "Facebook", DeviceKind.Phone, "Chrome");
        await AddVisitAsync(kept, "Facebook", DeviceKind.Phone, "Chrome");

        var report = await RunAsync(new FakeTimeProvider(new DateTimeOffset(2026, 11, 15, 4, 0, 0, TimeSpan.Zero)));

        Line(report, RawLabel).Value.ShouldBe(1);
        Line(report, RawLabel).Failed.ShouldBeFalse();
        (await ReadVisitDaysAsync()).ShouldBe([kept]);
        (await ReadReferrersAsync()).Select(row => row.Day).ShouldBe([gone, kept]);
    }

    [Fact]
    public async Task OldRawRowsAreRemovedByDateWithNoRollUpCursor()
    {
        await database.ResetAsync();
        var cut = AnalyticsRetention.RawCut(new DateOnly(2026, 11, 16));
        var old = cut.AddDays(-1);
        foreach (var _ in new[] { 1, 2 })
        {
            var visitId = await AddVisitAsync(old, "Facebook", DeviceKind.Phone, "Chrome");
            await AddPageViewsAsync(visitId, old, 1);
            await AddSampleAsync(visitId, old);
        }

        await AddVisitAsync(cut, "Facebook", DeviceKind.Phone, "Chrome");
        (await ReadCursorAsync()).ShouldBeNull();

        // Writes to the source totals fail, so nothing can have been rolled up and no cursor is ever saved.
        var report = await RunAsync(new FakeTimeProvider(Now), new FailCommandsOn("DailyReferrerCounts"));

        (await ReadCursorAsync()).ShouldBeNull();
        Line(report, RawLabel).Value.ShouldBe(6);
        Line(report, RawLabel).Failed.ShouldBeFalse();
        (await ReadVisitDaysAsync()).ShouldBe([cut]);
        await using var context = database.CreateContext();
        (await context.AnalyticsPageViews.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.AnalyticsVitalSamples.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task ARunAddsNoDeviceOrSourceTotals()
    {
        await database.ResetAsync();
        var yesterday = new DateOnly(2026, 11, 15);
        await AddVisitAsync(yesterday, "Facebook", DeviceKind.Phone, "Chrome");
        await AddVisitAsync(yesterday, ReferrerName.Direct, DeviceKind.Computer, "Edge");

        await RunAsync(new FakeTimeProvider(Now));

        (await ReadReferrersAsync()).ShouldBeEmpty();
        (await ReadDevicesAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task TheCutDateAtTheEndOfFebruaryKeepsTheFirstSurvivingDay()
    {
        await database.ResetAsync();
        await AddVisitAsync(new DateOnly(2026, 2, 27), "Facebook", DeviceKind.Phone, "Chrome");
        await AddVisitAsync(new DateOnly(2026, 2, 28), "Facebook", DeviceKind.Phone, "Chrome");

        await RunAsync(new FakeTimeProvider(new DateTimeOffset(2027, 3, 31, 4, 0, 0, TimeSpan.Zero)));

        (await ReadVisitDaysAsync()).ShouldBe([new DateOnly(2026, 2, 28)]);
    }

    [Fact]
    public async Task AnOldVisitTakesItsPageViewsAndSpeedSamplesWithItAndTheLineCountsEveryRow()
    {
        await database.ResetAsync();
        var day = new DateOnly(2025, 10, 14);
        var visitId = await AddVisitAsync(day, "Facebook", DeviceKind.Phone, "Chrome");
        await AddPageViewsAsync(visitId, day, 2);
        await AddSampleAsync(visitId, day);

        var report = await RunAsync(new FakeTimeProvider(new DateTimeOffset(2026, 11, 15, 4, 0, 0, TimeSpan.Zero)));

        Line(report, RawLabel).Value.ShouldBe(4);
        await using var context = database.CreateContext();
        (await context.AnalyticsPageViews.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.AnalyticsVitalSamples.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task ADayThatWasNotRolledUpIsNeverRemovedEvenWhenItIsOld()
    {
        await database.ResetAsync();
        await AddVisitAsync(new DateOnly(2025, 10, 11), "Facebook", DeviceKind.Phone, "Chrome");
        await AddVisitAsync(new DateOnly(2025, 10, 14), "Facebook", DeviceKind.Phone, "Chrome");
        await using (var context = database.CreateContext())
        {
            await new MaintenanceCursors(context, TimeProvider.System).SaveAsync(JobName, "2025-10-12", TestContext.Current.CancellationToken);
        }

        var report = await RunAsync(new FakeTimeProvider(new DateTimeOffset(2026, 11, 15, 4, 0, 0, TimeSpan.Zero)), new FailCommandsOn("DailyReferrerCounts"));

        Line(report, RolledUpLabel).Failed.ShouldBeTrue();
        Line(report, RawLabel).Value.ShouldBe(1);
        (await ReadVisitDaysAsync()).ShouldBe([new DateOnly(2025, 10, 14)]);
    }

    [Fact]
    public async Task WithNoCursorNothingIsRemovedWhenTheRollupFails()
    {
        await database.ResetAsync();
        await AddVisitAsync(new DateOnly(2025, 10, 14), "Facebook", DeviceKind.Phone, "Chrome");

        var report = await RunAsync(new FakeTimeProvider(new DateTimeOffset(2026, 11, 15, 4, 0, 0, TimeSpan.Zero)), new FailCommandsOn("DailyReferrerCounts"));

        Line(report, RawLabel).Value.ShouldBe(0);
        (await ReadVisitDaysAsync()).Count.ShouldBe(1);
    }

    [Fact]
    public async Task TwelveHundredOldPageViewsTakeThreeBatchesOf500()
    {
        await database.ResetAsync();
        var day = new DateOnly(2025, 10, 14);
        var visitId = await AddVisitAsync(day, "Facebook", DeviceKind.Phone, "Chrome");
        await AddPageViewsAsync(visitId, day, 1200);
        var counter = new CommandCounter();

        var report = await RunAsync(new FakeTimeProvider(new DateTimeOffset(2026, 11, 15, 4, 0, 0, TimeSpan.Zero)), counter);

        AnalyticsRetentionJob.BatchSize.ShouldBe(500);
        Line(report, RawLabel).Value.ShouldBe(1201);
        report.More.ShouldBeFalse();
        counter.Commands.Count(static command => command.Contains("DELETE", StringComparison.Ordinal) && command.Contains("AnalyticsPageViews", StringComparison.Ordinal)).ShouldBe(3);
    }

    [Fact]
    public async Task ASpentBudgetAfterTheFirstPageViewBatchStopsWithMoreAndTheNextRunFinishes()
    {
        await database.ResetAsync();
        var day = new DateOnly(2025, 10, 14);
        var visitId = await AddVisitAsync(day, "Facebook", DeviceKind.Phone, "Chrome");
        await AddPageViewsAsync(visitId, day, 1200);
        var now = new DateTimeOffset(2026, 11, 15, 4, 0, 0, TimeSpan.Zero);
        var clock = new FakeTimeProvider(now);

        var first = await RunAsync(clock, new SpendBudgetAfterFirst(clock, MaintenanceBudget.DefaultDuration, "DELETE|AnalyticsPageViews"), new MaintenanceBudget(clock));

        Line(first, RawLabel).Value.ShouldBe(500);
        first.More.ShouldBeTrue();
        first.Lines.Select(line => line.Label).ShouldNotContain(ConsentLabel);
        await using (var context = database.CreateContext())
        {
            (await context.AnalyticsPageViews.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(700);
        }

        var second = await RunAsync(new FakeTimeProvider(now));

        Line(second, RawLabel).Value.ShouldBe(701);
        second.More.ShouldBeFalse();
        (await ReadVisitDaysAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task AFailedVisitRemovalIsThatRulesFailedLineAndTheConsentRuleStillRuns()
    {
        await database.ResetAsync();
        await AddVisitAsync(new DateOnly(2025, 10, 14), "Facebook", DeviceKind.Phone, "Chrome");
        await AddConsentAsync(new DateTimeOffset(2025, 10, 14, 23, 59, 0, TimeSpan.Zero));

        var report = await RunAsync(new FakeTimeProvider(new DateTimeOffset(2026, 11, 15, 0, 0, 0, TimeSpan.Zero)), new FailDeletesOn("AnalyticsVisits"));

        var failed = Line(report, RawLabel);
        failed.Failed.ShouldBeTrue();
        failed.Value.ShouldBeNull();
        failed.Text.ShouldBe("The old visit records could not be removed.");
        Line(report, ConsentLabel).Value.ShouldBe(1);
        report.More.ShouldBeFalse();
    }

    [Fact]
    public async Task ACookieChoiceThirteenMonthsOldGoesAndOneAtTheCutMomentStays()
    {
        await database.ResetAsync();
        await AddConsentAsync(new DateTimeOffset(2025, 10, 14, 23, 59, 0, TimeSpan.Zero));
        await AddConsentAsync(new DateTimeOffset(2025, 10, 15, 0, 0, 0, TimeSpan.Zero));

        var report = await RunAsync(new FakeTimeProvider(new DateTimeOffset(2026, 11, 15, 0, 0, 0, TimeSpan.Zero)));

        Line(report, ConsentLabel).Value.ShouldBe(1);
        Line(report, ConsentLabel).Failed.ShouldBeFalse();
        (await ReadConsentTimesAsync()).ShouldBe([new DateTimeOffset(2025, 10, 15, 0, 0, 0, TimeSpan.Zero)]);
    }

    [Fact]
    public async Task ABacklogOfCookieChoicesIsRemovedInBatchesOf500()
    {
        await database.ResetAsync();
        await using (var context = database.CreateContext())
        {
            context.ConsentRecords.AddRange(Enumerable.Range(0, 1200).Select(index =>
                ConsentRecord.Decide(Guid.NewGuid(), "1.0", true, false, false, ConsentSource.Bar, new DateTimeOffset(2025, 1, 1, 0, 0, 0, TimeSpan.Zero).AddMinutes(index))));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var counter = new CommandCounter();

        var report = await RunAsync(new FakeTimeProvider(new DateTimeOffset(2026, 11, 15, 0, 0, 0, TimeSpan.Zero)), counter);

        Line(report, ConsentLabel).Value.ShouldBe(1200);
        counter.Commands.Count(static command => command.Contains("DELETE", StringComparison.Ordinal) && command.Contains("ConsentRecords", StringComparison.Ordinal)).ShouldBe(3);
    }

    [Fact]
    public async Task AFailedCookieChoiceRemovalIsThatRulesFailedLine()
    {
        await database.ResetAsync();
        await AddConsentAsync(new DateTimeOffset(2025, 10, 14, 23, 59, 0, TimeSpan.Zero));

        var report = await RunAsync(new FakeTimeProvider(new DateTimeOffset(2026, 11, 15, 0, 0, 0, TimeSpan.Zero)), new FailDeletesOn("ConsentRecords"));

        var failed = Line(report, ConsentLabel);
        failed.Failed.ShouldBeTrue();
        failed.Value.ShouldBeNull();
        failed.Text.ShouldBe("The old cookie choices could not be removed.");
        report.More.ShouldBeFalse();
    }

    [Fact]
    public async Task DailyTotalsOlderThanThreeYearsGoFromAllThreeTablesAndOneAtTheFloorStays()
    {
        await database.ResetAsync();
        var gone = new DateOnly(2023, 11, 14);
        var kept = new DateOnly(2023, 11, 15);
        await AddDailyRowsAsync(gone);
        await AddDailyRowsAsync(kept);

        var report = await RunAsync(new FakeTimeProvider(new DateTimeOffset(2026, 11, 15, 4, 0, 0, TimeSpan.Zero)));

        Line(report, DailyLabel).Value.ShouldBe(4);
        Line(report, DailyLabel).Failed.ShouldBeFalse();
        await using var context = database.CreateContext();
        (await context.DailyPageCounts.AsNoTracking().Select(row => row.BusinessDay).ToListAsync(TestContext.Current.CancellationToken)).ShouldBe([kept]);
        (await context.DailyReferrerCounts.AsNoTracking().Select(row => row.BusinessDay).ToListAsync(TestContext.Current.CancellationToken)).ShouldBe([kept]);
        (await context.DailyDeviceCounts.AsNoTracking().Select(row => row.BusinessDay).ToListAsync(TestContext.Current.CancellationToken)).ShouldBe([kept, kept]);
    }

    [Fact]
    public async Task TheDailyFloorAtALeapDayKeepsTheFirstSurvivingDay()
    {
        await database.ResetAsync();
        await AddDailyRowsAsync(new DateOnly(2025, 2, 27));
        await AddDailyRowsAsync(new DateOnly(2025, 2, 28));

        // Three years before 2028-02-29 is 2025-02-28.
        await RunAsync(new FakeTimeProvider(new DateTimeOffset(2028, 2, 29, 4, 0, 0, TimeSpan.Zero)));

        await using var context = database.CreateContext();
        (await context.DailyPageCounts.AsNoTracking().Select(row => row.BusinessDay).ToListAsync(TestContext.Current.CancellationToken)).ShouldBe([new DateOnly(2025, 2, 28)]);
    }

    [Fact]
    public async Task ABacklogOfOldDailyRowsIsRemovedInBatchesOf500()
    {
        await database.ResetAsync();
        var day = new DateOnly(2020, 1, 1);
        await using (var context = database.CreateContext())
        {
            context.DailyPageCounts.AddRange(Enumerable.Range(0, 1200).Select(index => DailyPageCount.First(day, "page" + index)));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var counter = new CommandCounter();

        var report = await RunAsync(new FakeTimeProvider(Now), counter);

        Line(report, DailyLabel).Value.ShouldBe(1200);
        counter.Commands.Count(static command => command.Contains("DELETE", StringComparison.Ordinal) && command.Contains("DailyPageCounts", StringComparison.Ordinal)).ShouldBe(3);
    }

    [Fact]
    public async Task AddressSaltsForTodayAndYesterdayStayAndOlderOnesGo()
    {
        await database.ResetAsync();
        var today = new DateOnly(2026, 11, 15);
        await AddSaltsAsync(today, today.AddDays(-1), today.AddDays(-2), today.AddDays(-30));

        var report = await RunAsync(new FakeTimeProvider(new DateTimeOffset(2026, 11, 15, 4, 0, 0, TimeSpan.Zero)));

        Line(report, SaltLabel).Value.ShouldBe(2);
        Line(report, SaltLabel).Failed.ShouldBeFalse();
        await using var context = database.CreateContext();
        (await context.AnalyticsSalts.AsNoTracking().OrderBy(salt => salt.BusinessDay).Select(salt => salt.BusinessDay).ToListAsync(TestContext.Current.CancellationToken))
            .ShouldBe([today.AddDays(-1), today]);
    }

    [Fact]
    public async Task TheFiveRulesReportTheirOwnLabelsInRunOrder()
    {
        await database.ResetAsync();

        var report = await RunAsync(new FakeTimeProvider(Now));

        report.Lines.Select(line => line.Label).ShouldBe(
            ["Visitor days rolled up", "Old visit records removed", "Old cookie choices removed", "Old daily visitor totals removed", "Old address salts removed"]);
        report.Lines.ShouldAllBe(line => !line.Failed && line.Value == 0);
        report.More.ShouldBeFalse();
    }

    [Fact]
    public async Task AFailedCookieChoiceRemovalDoesNotStopTheDailyTotalsAndSaltRules()
    {
        await database.ResetAsync();
        await AddConsentAsync(new DateTimeOffset(2025, 10, 14, 23, 59, 0, TimeSpan.Zero));
        await AddDailyRowsAsync(new DateOnly(2023, 11, 14));
        await AddSaltsAsync(new DateOnly(2026, 11, 10));

        var report = await RunAsync(new FakeTimeProvider(new DateTimeOffset(2026, 11, 15, 0, 0, 0, TimeSpan.Zero)), new FailDeletesOn("ConsentRecords"));

        Line(report, ConsentLabel).Failed.ShouldBeTrue();
        Line(report, DailyLabel).Value.ShouldBe(4);
        Line(report, SaltLabel).Value.ShouldBe(1);
        report.More.ShouldBeFalse();
    }

    [Fact]
    public async Task AFailedDailyTotalsRemovalIsThatRulesFailedLineAndTheSaltRuleStillRuns()
    {
        await database.ResetAsync();
        await AddDailyRowsAsync(new DateOnly(2023, 11, 14));
        await AddSaltsAsync(new DateOnly(2026, 11, 10));

        var report = await RunAsync(new FakeTimeProvider(Now), new FailDeletesOn("DailyPageCounts"));

        var failed = Line(report, DailyLabel);
        failed.Failed.ShouldBeTrue();
        failed.Value.ShouldBeNull();
        failed.Text.ShouldBe("The old daily visitor totals could not be removed.");
        Line(report, SaltLabel).Value.ShouldBe(1);
    }

    [Fact]
    public async Task AFailedSaltRemovalIsThatRulesFailedLine()
    {
        await database.ResetAsync();
        await AddSaltsAsync(new DateOnly(2026, 11, 10));

        var report = await RunAsync(new FakeTimeProvider(Now), new FailDeletesOn("AnalyticsSalts"));

        var failed = Line(report, SaltLabel);
        failed.Failed.ShouldBeTrue();
        failed.Value.ShouldBeNull();
        failed.Text.ShouldBe("The old address salts could not be removed.");
        report.More.ShouldBeFalse();
    }

    [Fact]
    public void TheJobRunsAtOrder15UnderItsFixedName()
    {
        using var context = database.CreateContext();
        var job = NewJob(context, new FakeTimeProvider(Now));

        job.Order.ShouldBe(15);
        job.Name.ShouldBe(JobName);
    }

    private static MaintenanceLine Line(MaintenanceJobReport report, string label) => report.Lines.Single(line => line.Label == label);

    private static AnalyticsRetentionJob NewJob(Csps.Infrastructure.Persistence.CspsDbContext context, FakeTimeProvider clock) =>
        new(context, new ManilaCalendar(clock), new MaintenanceCursors(context, clock), NullLogger<AnalyticsRetentionJob>.Instance);

    private async Task<MaintenanceJobReport> RunAsync(FakeTimeProvider clock, IInterceptor? hook = null, MaintenanceBudget? budget = null)
    {
        await using var context = hook is null ? database.CreateContext() : database.CreateContext(hook);
        var job = NewJob(context, clock);
        return await job.RunAsync(budget ?? new MaintenanceBudget(clock), TestContext.Current.CancellationToken);
    }

    private async Task<Guid> AddVisitAsync(DateOnly day, string referrer, DeviceKind device, string browser)
    {
        var hash = System.Security.Cryptography.RandomNumberGenerator.GetBytes(AnalyticsVisit.HashLength);
        var startedAt = new DateTimeOffset(day.ToDateTime(new TimeOnly(4, 0)), TimeSpan.Zero);
        var visit = AnalyticsVisit.Start(hash, day, startedAt, referrer, device, browser, "Windows", null);
        await using var context = database.CreateContext();
        context.AnalyticsVisits.Add(visit);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return visit.Id;
    }

    private async Task AddPageViewsAsync(Guid visitId, DateOnly day, int count)
    {
        var at = new DateTimeOffset(day.ToDateTime(new TimeOnly(5, 0)), TimeSpan.Zero);
        await using var context = database.CreateContext();
        context.AnalyticsPageViews.AddRange(Enumerable.Range(0, count).Select(_ => AnalyticsPageView.Of(visitId, day, at, PageKeys.Gallery)));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task AddSampleAsync(Guid visitId, DateOnly day)
    {
        await using var context = database.CreateContext();
        context.AnalyticsVitalSamples.Add(AnalyticsVitalSample.Of(visitId, day, VitalMetric.Lcp, 2100m, PageKeys.Gallery));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task AddConsentAsync(DateTimeOffset decidedAt)
    {
        await using var context = database.CreateContext();
        context.ConsentRecords.Add(ConsentRecord.Decide(Guid.NewGuid(), "1.0", true, false, false, ConsentSource.Bar, decidedAt));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    // One row per daily table for the day: 1 + 1 + 2 = 4 rows.
    private async Task AddDailyRowsAsync(DateOnly day)
    {
        await using var context = database.CreateContext();
        context.DailyPageCounts.Add(DailyPageCount.First(day, PageKeys.Gallery));
        context.DailyReferrerCounts.Add(DailyReferrerCount.Of(day, "Facebook", 1));
        context.DailyDeviceCounts.Add(DailyDeviceCount.Of(day, DeviceDimension.Device, "Phone", 1));
        context.DailyDeviceCounts.Add(DailyDeviceCount.Of(day, DeviceDimension.Browser, "Chrome", 1));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task AddSaltsAsync(params DateOnly[] days)
    {
        await using var context = database.CreateContext();
        context.AnalyticsSalts.AddRange(days.Select(day => AnalyticsSalt.Create(day, System.Security.Cryptography.RandomNumberGenerator.GetBytes(AnalyticsSalt.Length))));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<List<DateOnly>> ReadVisitDaysAsync()
    {
        await using var context = database.CreateContext();
        return await context.AnalyticsVisits.AsNoTracking().OrderBy(visit => visit.BusinessDay).Select(visit => visit.BusinessDay).ToListAsync(TestContext.Current.CancellationToken);
    }

    private async Task<List<DateTimeOffset>> ReadConsentTimesAsync()
    {
        await using var context = database.CreateContext();
        return await context.ConsentRecords.AsNoTracking().OrderBy(record => record.DecidedAtUtc).Select(record => record.DecidedAtUtc).ToListAsync(TestContext.Current.CancellationToken);
    }

    private async Task<List<(DateOnly Day, string Name, int Visits)>> ReadReferrersAsync()
    {
        await using var context = database.CreateContext();
        var rows = await context.DailyReferrerCounts.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken);
        return [.. rows.OrderBy(row => row.BusinessDay).ThenBy(row => row.Referrer, StringComparer.Ordinal).Select(row => (row.BusinessDay, row.Referrer, row.Visits))];
    }

    private async Task<List<(DateOnly Day, DeviceDimension Dimension, string Name, int Visits)>> ReadDevicesAsync()
    {
        await using var context = database.CreateContext();
        var rows = await context.DailyDeviceCounts.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken);
        return [.. rows.OrderBy(row => row.BusinessDay).ThenBy(row => row.Dimension).ThenBy(row => row.Name, StringComparer.Ordinal).Select(row => (row.BusinessDay, row.Dimension, row.Name, row.Visits))];
    }

    private async Task<string?> ReadCursorAsync()
    {
        await using var context = database.CreateContext();
        return await new MaintenanceCursors(context, TimeProvider.System).GetAsync(JobName, TestContext.Current.CancellationToken);
    }

    // The business clock for Asia/Manila at the fake time.
    private sealed class ManilaCalendar(FakeTimeProvider clock) : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken)
        {
            var (zone, source) = TimeZoneResolver.Resolve("Asia/Manila");
            return ValueTask.FromResult(new BusinessClock(zone, source, clock.GetUtcNow()));
        }
    }

    private sealed class TestDatabaseException() : DbException("The test database failed.");

    // Fails every command that touches one table with a database error.
    private sealed class FailCommandsOn(string table) : DbCommandInterceptor
    {
        public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            Fail(command);
            return base.NonQueryExecutingAsync(command, eventData, result, cancellationToken);
        }

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            Fail(command);
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }

        private void Fail(DbCommand command)
        {
            if (command.CommandText.Contains(table, StringComparison.Ordinal))
            {
                throw new TestDatabaseException();
            }
        }
    }

    // Fails every delete on one table with a database error.
    private sealed class FailDeletesOn(string table) : DbCommandInterceptor
    {
        public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("DELETE", StringComparison.Ordinal) && command.CommandText.Contains(table, StringComparison.Ordinal))
            {
                throw new TestDatabaseException();
            }

            return base.NonQueryExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    // Moves the clock forward once the first command holding every '|'-separated part of the marker has run, as if that step took the whole budget.
    private sealed class SpendBudgetAfterFirst(FakeTimeProvider clock, TimeSpan by, string marker) : DbCommandInterceptor
    {
        private int _advanced;

        public override ValueTask<int> NonQueryExecutedAsync(
            DbCommand command, CommandExecutedEventData eventData, int result, CancellationToken cancellationToken = default)
        {
            Advance(command);
            return base.NonQueryExecutedAsync(command, eventData, result, cancellationToken);
        }

        public override ValueTask<DbDataReader> ReaderExecutedAsync(
            DbCommand command, CommandExecutedEventData eventData, DbDataReader result, CancellationToken cancellationToken = default)
        {
            Advance(command);
            return base.ReaderExecutedAsync(command, eventData, result, cancellationToken);
        }

        private void Advance(DbCommand command)
        {
            var matches = marker.Split('|').All(part => command.CommandText.Contains(part, StringComparison.Ordinal));
            if (matches && Interlocked.Exchange(ref _advanced, 1) == 0)
            {
                clock.Advance(by);
            }
        }
    }
}
