using System.Data.Common;
using Csps.Application.Maintenance;
using Csps.Infrastructure.Idempotency;
using Csps.Infrastructure.Maintenance;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Maintenance;

/// <summary>SEC-06, JOB-01: the purge removes only rows past their own expiry, in batches of 500, and stops between batches when the budget is spent.</summary>
public sealed class PurgeExpiredRecordsJobTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string PurgeLabel = "Expired request keys removed";

    private static readonly DateTimeOffset Now = new(2026, 11, 3, 12, 0, 0, TimeSpan.Zero);
    private static readonly TimeSpan ClaimLease = TimeSpan.FromMinutes(2);

    [Fact]
    public async Task ABigBacklogIsRemovedInBatchesOf500WhenTheBudgetAllows()
    {
        await database.ResetAsync();
        await StoreRecordsAsync(1200, expiresAt: Now - TimeSpan.FromHours(1));
        var counter = new CommandCounter();
        var clock = new FakeTimeProvider(Now);

        var report = await RunAsync(clock, counter);

        PurgeBatchSize.ShouldBe(500);
        var line = report.Lines.ShouldHaveSingleItem();
        line.Label.ShouldBe(PurgeLabel);
        line.Value.ShouldBe(1200);
        line.Failed.ShouldBeFalse();
        report.More.ShouldBeFalse();
        counter.Commands.Count(static command => command.Contains("DELETE", StringComparison.Ordinal) && command.Contains("IdempotencyRecords", StringComparison.Ordinal)).ShouldBe(3);
        (await CountRecordsAsync()).ShouldBe(0);
    }

    [Fact]
    public async Task ASpentBudgetAfterOneBatchStopsWithMoreAnd500Removed()
    {
        await database.ResetAsync();
        await StoreRecordsAsync(1200, expiresAt: Now - TimeSpan.FromHours(1));
        var clock = new FakeTimeProvider(Now);
        var budget = new MaintenanceBudget(clock);
        var spendAfterFirstDelete = new AdvanceAfterFirstDelete(clock, MaintenanceBudget.DefaultDuration);

        var report = await RunAsync(clock, spendAfterFirstDelete, budget);

        var line = report.Lines.ShouldHaveSingleItem();
        line.Value.ShouldBe(500);
        line.Failed.ShouldBeFalse();
        report.More.ShouldBeTrue();
        (await CountRecordsAsync()).ShouldBe(700);
    }

    [Fact]
    public async Task TheNextCallFinishesTheWorkTheBudgetCutOff()
    {
        await database.ResetAsync();
        await StoreRecordsAsync(1200, expiresAt: Now - TimeSpan.FromHours(1));
        var clock = new FakeTimeProvider(Now);
        await RunAsync(clock, new AdvanceAfterFirstDelete(clock, MaintenanceBudget.DefaultDuration), new MaintenanceBudget(clock));

        var report = await RunAsync(new FakeTimeProvider(Now));

        report.Lines.ShouldHaveSingleItem().Value.ShouldBe(700);
        report.More.ShouldBeFalse();
        (await CountRecordsAsync()).ShouldBe(0);
    }

    [Fact]
    public async Task ARecordExpiringExactlyNowIsRemovedAndOneExpiringATickLaterStays()
    {
        await database.ResetAsync();
        var gone = await StoreRecordAsync(Now);
        var kept = await StoreRecordAsync(Now + TimeSpan.FromTicks(1));

        var report = await RunAsync(new FakeTimeProvider(Now));

        report.Lines.ShouldHaveSingleItem().Value.ShouldBe(1);
        var left = await ReadRecordKeysAsync();
        left.ShouldContain(kept);
        left.ShouldNotContain(gone);
    }

    [Fact]
    public async Task ExpiredClaimsGoAndLiveClaimsAndStandingLocksStay()
    {
        await database.ResetAsync();
        await ClearClaimsAsync();
        await StoreClaimsAsync(("idem:expired-exactly-now", Now - ClaimLease), ("idem:expired-long-ago", Now - TimeSpan.FromHours(2)), ("idem:live", Now + TimeSpan.FromMinutes(1)), ("idem:live-by-a-tick", Now + TimeSpan.FromTicks(1)));
        var standingBefore = await CountStandingLocksAsync();

        var report = await RunAsync(new FakeTimeProvider(Now));

        report.Lines.ShouldHaveSingleItem().Value.ShouldBe(2);
        (await ReadClaimNamesAsync()).Order().ToArray().ShouldBe(["idem:live", "idem:live-by-a-tick"]);
        (await CountStandingLocksAsync()).ShouldBe(standingBefore);
        standingBefore.ShouldBeGreaterThan(0);
    }

    [Fact]
    public async Task RecordsAndClaimsAddUpInOneLine()
    {
        await database.ResetAsync();
        await ClearClaimsAsync();
        await StoreRecordsAsync(3, expiresAt: Now - TimeSpan.FromHours(1));
        await StoreClaimsAsync(("idem:old-a", Now - TimeSpan.FromHours(1)), ("idem:old-b", Now - TimeSpan.FromHours(1)));

        var report = await RunAsync(new FakeTimeProvider(Now));

        report.Lines.ShouldHaveSingleItem().Value.ShouldBe(5);
    }

    private static int PurgeBatchSize => PurgeExpiredRecordsJob.BatchSize;

    private async Task<MaintenanceJobReport> RunAsync(FakeTimeProvider clock, IInterceptor? hook = null, MaintenanceBudget? budget = null)
    {
        await using var context = hook is null ? database.CreateContext() : database.CreateContext(hook);
        var job = new PurgeExpiredRecordsJob(context, clock, NullLogger<PurgeExpiredRecordsJob>.Instance);
        return await job.RunAsync(budget ?? new MaintenanceBudget(clock), TestContext.Current.CancellationToken);
    }

    private async Task StoreRecordsAsync(int count, DateTimeOffset expiresAt)
    {
        await using var context = database.CreateContext();
        for (var index = 0; index < count; index++)
        {
            context.Add(NewRecord(Guid.NewGuid(), expiresAt));
        }

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<Guid> StoreRecordAsync(DateTimeOffset expiresAt)
    {
        var key = Guid.NewGuid();
        await using var context = database.CreateContext();
        context.Add(NewRecord(key, expiresAt));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return key;
    }

    // A record lives IdempotencyRecord.Lifetime from its creation time, so the creation time is set back to land on the wanted expiry.
    private static IdempotencyRecord NewRecord(Guid key, DateTimeOffset expiresAt) =>
        IdempotencyRecord.Create(key, null, "POST /test/purge", new byte[32], 200, null, null, null, expiresAt - IdempotencyRecord.Lifetime);

    private async Task StoreClaimsAsync(params (string Name, DateTimeOffset ExpiresAt)[] claims)
    {
        await using var context = database.CreateContext();
        foreach (var (name, expiresAt) in claims)
        {
            context.Add(DatabaseLock.Claim(name, Guid.NewGuid(), expiresAt - ClaimLease, ClaimLease));
        }

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task ClearClaimsAsync()
    {
        await using var context = database.CreateContext();
        await context.Set<DatabaseLock>().Where(claim => claim.ExpiresAtUtc != null).ExecuteDeleteAsync(TestContext.Current.CancellationToken);
    }

    private async Task<int> CountRecordsAsync()
    {
        await using var context = database.CreateContext();
        return await context.Set<IdempotencyRecord>().CountAsync(TestContext.Current.CancellationToken);
    }

    private async Task<IReadOnlyList<Guid>> ReadRecordKeysAsync()
    {
        await using var context = database.CreateContext();
        return await context.Set<IdempotencyRecord>().AsNoTracking().Select(record => record.Key).ToListAsync(TestContext.Current.CancellationToken);
    }

    private async Task<IReadOnlyList<string>> ReadClaimNamesAsync()
    {
        await using var context = database.CreateContext();
        return await context.Set<DatabaseLock>().AsNoTracking()
            .Where(claim => claim.ExpiresAtUtc != null)
            .Select(claim => claim.Name)
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    private async Task<int> CountStandingLocksAsync()
    {
        await using var context = database.CreateContext();
        return await context.Set<DatabaseLock>().CountAsync(claim => claim.ExpiresAtUtc == null, TestContext.Current.CancellationToken);
    }

    // Moves the clock forward once the first delete of the idempotency records has run, as if that batch took the whole budget.
    private sealed class AdvanceAfterFirstDelete(FakeTimeProvider clock, TimeSpan by) : DbCommandInterceptor
    {
        private int _advanced;

        public override ValueTask<int> NonQueryExecutedAsync(
            DbCommand command, CommandExecutedEventData eventData, int result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("IdempotencyRecords", StringComparison.Ordinal) && Interlocked.Exchange(ref _advanced, 1) == 0)
            {
                clock.Advance(by);
            }

            return base.NonQueryExecutedAsync(command, eventData, result, cancellationToken);
        }
    }
}
