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

        var first = await RunAsync(clock, new SpendBudgetAfterFirstInsert(clock, MaintenanceBudget.DefaultDuration), new MaintenanceBudget(clock));

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
    public void TheJobRunsAtOrder15UnderItsFixedName()
    {
        using var context = database.CreateContext();
        var job = NewJob(context, new FakeTimeProvider(Now));

        job.Order.ShouldBe(15);
        job.Name.ShouldBe(JobName);
    }

    private static MaintenanceLine Line(MaintenanceJobReport report, string label) => report.Lines.Single(line => line.Label == label);

    private static AnalyticsRetentionJob NewJob(Csps.Infrastructure.Persistence.CspsDbContext context, FakeTimeProvider clock) =>
        new(context, new ManilaCalendar(clock), new MaintenanceCursors(context, clock), clock, NullLogger<AnalyticsRetentionJob>.Instance);

    private async Task<MaintenanceJobReport> RunAsync(FakeTimeProvider clock, IInterceptor? hook = null, MaintenanceBudget? budget = null)
    {
        await using var context = hook is null ? database.CreateContext() : database.CreateContext(hook);
        var job = NewJob(context, clock);
        return await job.RunAsync(budget ?? new MaintenanceBudget(clock), TestContext.Current.CancellationToken);
    }

    private async Task AddVisitAsync(DateOnly day, string referrer, DeviceKind device, string browser)
    {
        var hash = System.Security.Cryptography.RandomNumberGenerator.GetBytes(AnalyticsVisit.HashLength);
        var startedAt = new DateTimeOffset(day.ToDateTime(new TimeOnly(4, 0)), TimeSpan.Zero);
        var visit = AnalyticsVisit.Start(hash, day, startedAt, referrer, device, browser, "Windows", null);
        await using var context = database.CreateContext();
        context.AnalyticsVisits.Add(visit);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
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

    // Moves the clock forward once the first daily referrer row is written, as if that day took the whole budget.
    private sealed class SpendBudgetAfterFirstInsert(FakeTimeProvider clock, TimeSpan by) : DbCommandInterceptor
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
            if (command.CommandText.Contains("INSERT INTO [DailyReferrerCounts]", StringComparison.Ordinal) && Interlocked.Exchange(ref _advanced, 1) == 0)
            {
                clock.Advance(by);
            }
        }
    }
}
