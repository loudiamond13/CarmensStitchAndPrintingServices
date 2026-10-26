using System.Data.Common;
using System.Security.Cryptography;
using Csps.Infrastructure.Idempotency;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging.Testing;

namespace Csps.Infrastructure.IntegrationTests.Idempotency;

/// <summary>
/// D-50, SEC-06: the duplicate request guard is a claim row committed on its own. A duplicate gets Busy at once, a stored answer
/// replays, an ended request frees its key, and a stale claim is taken over by exactly one request.
/// </summary>
public sealed class IdempotencyGateTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "POST /probe/gate";
    private const string ContentType = "application/json";

    private static readonly DateTimeOffset Now = new(2026, 10, 25, 12, 0, 0, TimeSpan.Zero);
    private static readonly TimeSpan Patience = TimeSpan.FromSeconds(20);

    [Fact]
    public async Task TwoRequestsForOneKeyGiveOneProceedAndOneBusyEveryRound()
    {
        for (var round = 0; round < 50; round++)
        {
            var key = Guid.NewGuid();
            await using var first = NewGate();
            await using var second = NewGate();
            var hash = Hash();
            var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

            var begins = new[] { first, second }.Select(handle => Task.Run(async () =>
            {
                await gate.Task.ConfigureAwait(false);
                return await handle.Gate.BeginAsync(key, Route, null, hash, Now, TestContext.Current.CancellationToken).ConfigureAwait(false);
            })).ToArray();
            gate.SetResult();
            var leases = await Task.WhenAll(begins).WaitAsync(Patience, TestContext.Current.CancellationToken);

            var proceed = leases.Single(lease => lease.State == IdempotencyLeaseState.Proceed);
            leases.Single(lease => lease.State == IdempotencyLeaseState.Busy).ShouldNotBeNull();
            await proceed.StoreAndCommitAsync(200, "{}", ContentType, null, TestContext.Current.CancellationToken);

            await using var third = NewGate();
            var replay = await third.Gate.BeginAsync(key, Route, null, hash, Now, TestContext.Current.CancellationToken);
            replay.State.ShouldBe(IdempotencyLeaseState.Replay);
            replay.Replay.ShouldNotBeNull().StatusCode.ShouldBe(200);

            await replay.DisposeAsync();
            foreach (var lease in leases)
            {
                await lease.DisposeAsync();
            }

            (await ClaimCountAsync(key)).ShouldBe(0);
        }
    }

    [Fact]
    public async Task ARolledBackLeaseFreesTheKeyAtOnce()
    {
        var key = Guid.NewGuid();
        await using var handle = NewGate();
        var lease = await handle.Gate.BeginAsync(key, Route, null, Hash(), Now, TestContext.Current.CancellationToken);
        lease.State.ShouldBe(IdempotencyLeaseState.Proceed);
        (await ClaimCountAsync(key)).ShouldBe(1);

        await lease.RollbackAsync(TestContext.Current.CancellationToken);
        await lease.DisposeAsync();

        (await ClaimCountAsync(key)).ShouldBe(0);
        await AssertProceedsAsync(key);
    }

    [Fact]
    public async Task ALeaseDisposedUnfinishedFreesTheKeyAtOnce()
    {
        var key = Guid.NewGuid();
        await using var handle = NewGate();
        var lease = await handle.Gate.BeginAsync(key, Route, null, Hash(), Now, TestContext.Current.CancellationToken);
        lease.State.ShouldBe(IdempotencyLeaseState.Proceed);

        await lease.DisposeAsync();

        (await ClaimCountAsync(key)).ShouldBe(0);
        await AssertProceedsAsync(key);
    }

    [Fact]
    public async Task ACommitWithoutRecordLeavesNoClaimAndNoRecord()
    {
        var key = Guid.NewGuid();
        await using var handle = NewGate();
        var lease = await handle.Gate.BeginAsync(key, Route, null, Hash(), Now, TestContext.Current.CancellationToken);
        lease.State.ShouldBe(IdempotencyLeaseState.Proceed);

        await lease.CommitWithoutRecordAsync(TestContext.Current.CancellationToken);
        await lease.DisposeAsync();

        (await ClaimCountAsync(key)).ShouldBe(0);
        (await RecordCountAsync(key)).ShouldBe(0);
        await AssertProceedsAsync(key);
    }

    [Fact]
    public async Task AnExpiredClaimNeverBlocksTheKey()
    {
        var key = Guid.NewGuid();
        await WriteClaimAsync(key, Now - IdempotencyGate.ClaimLease - TimeSpan.FromSeconds(1));

        await AssertProceedsAsync(key);
    }

    [Fact]
    public async Task AClaimStillInItsLeaseGivesBusy()
    {
        var key = Guid.NewGuid();
        await WriteClaimAsync(key, Now);
        await using var handle = NewGate();

        await using var lease = await handle.Gate.BeginAsync(key, Route, null, Hash(), Now + TimeSpan.FromSeconds(30), TestContext.Current.CancellationToken);

        lease.State.ShouldBe(IdempotencyLeaseState.Busy);
        (await ClaimCountAsync(key)).ShouldBe(1);
    }

    [Fact]
    public async Task FiveRequestsTakingOverOneStaleClaimLeaveExactlyOneWinner()
    {
        for (var round = 0; round < 20; round++)
        {
            var key = Guid.NewGuid();
            var name = IdempotencyGate.ClaimName(key, Route, null);
            await WriteClaimAsync(key, Now - IdempotencyGate.ClaimLease - TimeSpan.FromMinutes(1));
            var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

            var tries = Enumerable.Range(0, 5).Select(_ => Task.Run(async () =>
            {
                var holder = Guid.NewGuid();
                await using var handle = NewGate();
                await gate.Task.ConfigureAwait(false);
                var won = await handle.Gate.TryClaimAsync(name, holder, Now, TestContext.Current.CancellationToken).ConfigureAwait(false);
                return (holder, won);
            })).ToArray();
            gate.SetResult();
            var results = await Task.WhenAll(tries).WaitAsync(Patience, TestContext.Current.CancellationToken);

            var winner = results.Single(result => result.won);
            await using var context = database.CreateContext();
            var row = await context.Set<DatabaseLock>().AsNoTracking().SingleAsync(claim => claim.Name == name, TestContext.Current.CancellationToken);
            row.HolderId.ShouldBe(winner.holder);
            row.ExpiresAtUtc.ShouldBe(Now + IdempotencyGate.ClaimLease);
        }
    }

    [Fact]
    public async Task ALeaseWhoseClaimWasTakenOverDoesNotDeleteTheNewHoldersClaim()
    {
        foreach (var ending in new[] { "rollback", "dispose", "store" })
        {
            var key = Guid.NewGuid();
            var name = IdempotencyGate.ClaimName(key, Route, null);
            await using var handle = NewGate();
            var lease = await handle.Gate.BeginAsync(key, Route, null, Hash(), Now, TestContext.Current.CancellationToken);
            lease.State.ShouldBe(IdempotencyLeaseState.Proceed);
            var newHolder = Guid.NewGuid();
            await using (var context = database.CreateContext())
            {
                await context.Set<DatabaseLock>().Where(claim => claim.Name == name)
                    .ExecuteUpdateAsync(set => set.SetProperty(claim => claim.HolderId, newHolder), TestContext.Current.CancellationToken);
            }

            switch (ending)
            {
                case "rollback":
                    await lease.RollbackAsync(TestContext.Current.CancellationToken);
                    break;
                case "store":
                    await lease.StoreAndCommitAsync(200, null, null, null, TestContext.Current.CancellationToken);
                    break;
            }

            await lease.DisposeAsync();

            await using var check = database.CreateContext();
            (await check.Set<DatabaseLock>().AsNoTracking().SingleAsync(claim => claim.Name == name, TestContext.Current.CancellationToken))
                .HolderId.ShouldBe(newHolder, ending);
        }
    }

    [Fact]
    public async Task ThePurgeRemovesAtMostOneBatchOfExpiredClaimsAndNeverAStandingLock()
    {
        await using (var context = database.CreateContext())
        {
            await context.Set<DatabaseLock>().Where(claim => claim.ExpiresAtUtc != null).ExecuteDeleteAsync(TestContext.Current.CancellationToken);
            for (var index = 0; index < IdempotencyGate.PurgeBatchSize + 5; index++)
            {
                context.Add(DatabaseLock.Claim($"idem:purge-{index:D3}", Guid.NewGuid(), Now - TimeSpan.FromHours(1), IdempotencyGate.ClaimLease));
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var handle = NewGate();
        await using var lease = await handle.Gate.BeginAsync(Guid.NewGuid(), Route, null, Hash(), Now, TestContext.Current.CancellationToken);

        await using var after = database.CreateContext();
        (await after.Set<DatabaseLock>().CountAsync(claim => claim.Name.StartsWith("idem:purge-"), TestContext.Current.CancellationToken)).ShouldBe(5);
        (await after.Set<DatabaseLock>().CountAsync(claim => claim.ExpiresAtUtc == null, TestContext.Current.CancellationToken)).ShouldBe(65);
    }

    [Fact]
    public async Task ADifferentBodyIsAMismatchAndAnOldRecordIsReplaced()
    {
        var key = Guid.NewGuid();
        await using var handle = NewGate();
        var first = await handle.Gate.BeginAsync(key, Route, null, Hash(), Now, TestContext.Current.CancellationToken);
        await first.StoreAndCommitAsync(201, "{}", ContentType, "/items/1", TestContext.Current.CancellationToken);
        await first.DisposeAsync();

        await using var otherBody = NewGate();
        await using var mismatch = await otherBody.Gate.BeginAsync(key, Route, null, Hash(), Now, TestContext.Current.CancellationToken);
        mismatch.State.ShouldBe(IdempotencyLeaseState.Mismatch);
        (await ClaimCountAsync(key)).ShouldBe(1);
        await mismatch.DisposeAsync();
        (await ClaimCountAsync(key)).ShouldBe(0);

        await using var later = NewGate();
        await using var replaced = await later.Gate.BeginAsync(key, Route, null, Hash(), Now + IdempotencyRecord.Lifetime + TimeSpan.FromSeconds(1), TestContext.Current.CancellationToken);
        replaced.State.ShouldBe(IdempotencyLeaseState.Proceed);
    }

    [Fact]
    public async Task APurgeThatFailsWithAWrappedDatabaseErrorIsLoggedAndTheRequestGoesOn()
    {
        var failure = await DatabaseFailureAsync();
        var logger = new FakeLogger<IdempotencyGate>();
        await using var handle = NewGate(requestHooks: [new NonQueryHook("DELETE", () => throw failure)], logger: logger);

        await using var lease = await handle.Gate.BeginAsync(Guid.NewGuid(), Route, null, Hash(), Now, TestContext.Current.CancellationToken);

        lease.State.ShouldBe(IdempotencyLeaseState.Proceed);
        logger.Collector.GetSnapshot().ShouldContain(record => record.Level == LogLevel.Warning && record.Message.Contains("Expired idempotency records", StringComparison.Ordinal));
    }

    [Fact]
    public async Task AReleaseThatFailsWithAWrappedDatabaseErrorNeverFailsTheEndOfTheLease()
    {
        var failure = await DatabaseFailureAsync();
        foreach (var ending in new[] { "rollback", "dispose" })
        {
            var key = Guid.NewGuid();
            var logger = new FakeLogger<IdempotencyGate>();
            await using var handle = NewGate(claimHooks: [new NonQueryHook("DELETE", () => throw failure)], logger: logger);
            var lease = await handle.Gate.BeginAsync(key, Route, null, Hash(), Now, TestContext.Current.CancellationToken);
            lease.State.ShouldBe(IdempotencyLeaseState.Proceed);

            if (ending == "rollback")
            {
                await lease.RollbackAsync(TestContext.Current.CancellationToken);
            }

            await lease.DisposeAsync();

            handle.Context.Database.CurrentTransaction.ShouldBeNull(ending);
            (await ClaimCountAsync(key)).ShouldBe(1, "a claim that cannot be freed ends with its lease");
            logger.Collector.GetSnapshot().ShouldContain(record => record.Level == LogLevel.Warning, ending);
        }
    }

    [Fact]
    public async Task ARollbackThatFailsOnDisposeNeverReplacesTheRequestErrorAndStillFreesEverything()
    {
        var key = Guid.NewGuid();
        var logger = new FakeLogger<IdempotencyGate>();
        await using var handle = NewGate(requestHooks: [new FailingRollback()], logger: logger);
        var lease = await handle.Gate.BeginAsync(key, Route, null, Hash(), Now, TestContext.Current.CancellationToken);
        lease.State.ShouldBe(IdempotencyLeaseState.Proceed);

        await lease.DisposeAsync();

        handle.Context.Database.CurrentTransaction.ShouldBeNull();
        (await ClaimCountAsync(key)).ShouldBe(0);
        logger.Collector.GetSnapshot().ShouldContain(record => record.Level == LogLevel.Warning);
    }

    [Fact]
    public async Task ADeadlockWhileTakingOverAStaleClaimReadsAsInProgress()
    {
        var deadlock = await DeadlockAsync();
        var key = Guid.NewGuid();
        await WriteClaimAsync(key, Now - IdempotencyGate.ClaimLease - TimeSpan.FromMinutes(1));
        await using var handle = NewGate(claimHooks: [new NonQueryHook("UPDATE", () => throw deadlock)]);

        // The claim step itself, so the request's purge does not remove the stale claim first.
        var won = await handle.Gate.TryClaimAsync(IdempotencyGate.ClaimName(key, Route, null), Guid.NewGuid(), Now, TestContext.Current.CancellationToken);

        won.ShouldBeFalse();
    }

    [Fact]
    public async Task AStaleClaimPurgedBetweenTheReadAndTheTakeoverLeavesTheKeyFreeToClaim()
    {
        var key = Guid.NewGuid();
        var name = IdempotencyGate.ClaimName(key, Route, null);
        await WriteClaimAsync(key, Now - IdempotencyGate.ClaimLease - TimeSpan.FromMinutes(1));
        var purged = false;
        var purgeFirst = new NonQueryHook("UPDATE", async () =>
        {
            if (purged)
            {
                return;
            }

            purged = true;
            await using var other = database.CreateContext();
            await other.Set<DatabaseLock>().Where(claim => claim.Name == name).ExecuteDeleteAsync(TestContext.Current.CancellationToken);
        });
        await using var handle = NewGate(claimHooks: [purgeFirst]);
        var holder = Guid.NewGuid();

        var won = await handle.Gate.TryClaimAsync(name, holder, Now, TestContext.Current.CancellationToken);

        purged.ShouldBeTrue();
        won.ShouldBeTrue();
        await using var check = database.CreateContext();
        (await check.Set<DatabaseLock>().AsNoTracking().SingleAsync(claim => claim.Name == name, TestContext.Current.CancellationToken)).HolderId.ShouldBe(holder);
    }

    private static byte[] Hash() => RandomNumberGenerator.GetBytes(32);

    // A real SQL error wrapped the way EF's SQL Server strategy wraps a transient one: a duplicate standing lock row.
    private async Task<Exception> DatabaseFailureAsync()
    {
        await using var context = database.CreateContext();
        context.Add(DatabaseLock.Claim(DatabaseLocks.ActiveManagers, Guid.NewGuid(), Now, IdempotencyGate.ClaimLease));
        var error = await Should.ThrowAsync<DbUpdateException>(() => context.SaveChangesAsync(TestContext.Current.CancellationToken));
        return new InvalidOperationException("An exception has been raised that is likely due to a transient failure.", error.InnerException.ShouldBeOfType<SqlException>());
    }

    // A real deadlock as EF reports it: two transactions each update one standing lock row, then reach for the other's.
    private async Task<Exception> DeadlockAsync()
    {
        await using var one = database.CreateContext();
        await using var two = database.CreateContext();
        var first = await one.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        var second = await two.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (first)
        await using (second)
        {
            await TouchAsync(one, "account-token:60");
            await TouchAsync(two, "account-token:61");
            var outcomes = await Task.WhenAll(CaptureAsync(() => TouchAsync(one, "account-token:61")), CaptureAsync(() => TouchAsync(two, "account-token:60")))
                .WaitAsync(TimeSpan.FromSeconds(60), TestContext.Current.CancellationToken);
            return outcomes.Single(outcome => outcome is not null).ShouldNotBeNull();
        }

        static Task TouchAsync(CspsDbContext context, string lockName) =>
            context.Set<DatabaseLock>().Where(row => row.Name == lockName)
                .ExecuteUpdateAsync(set => set.SetProperty(row => row.TakenAtUtc, Now), TestContext.Current.CancellationToken);

        static async Task<Exception?> CaptureAsync(Func<Task> work)
        {
            try
            {
                await work();
                return null;
            }
            catch (InvalidOperationException error) when (error.InnerException is SqlException { Number: 1205 })
            {
                return error;
            }
        }
    }

    private GateHandle NewGate(IInterceptor[]? requestHooks = null, IInterceptor[]? claimHooks = null, ILogger<IdempotencyGate>? logger = null)
    {
        var context = database.CreateContext(requestHooks ?? []);
        var gate = new IdempotencyGate(context, new TestContextFactory(database, claimHooks ?? []), logger ?? NullLogger<IdempotencyGate>.Instance);
        return new GateHandle(context, gate);
    }

    private async Task AssertProceedsAsync(Guid key)
    {
        await using var handle = NewGate();
        await using var lease = await handle.Gate.BeginAsync(key, Route, null, Hash(), Now, TestContext.Current.CancellationToken);
        lease.State.ShouldBe(IdempotencyLeaseState.Proceed);
    }

    // A claim row written directly, as if a request had claimed the key at the given time.
    private async Task WriteClaimAsync(Guid key, DateTimeOffset claimedAt)
    {
        await using var context = database.CreateContext();
        context.Add(DatabaseLock.Claim(IdempotencyGate.ClaimName(key, Route, null), Guid.NewGuid(), claimedAt, IdempotencyGate.ClaimLease));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<int> ClaimCountAsync(Guid key)
    {
        var name = IdempotencyGate.ClaimName(key, Route, null);
        await using var context = database.CreateContext();
        return await context.Set<DatabaseLock>().CountAsync(claim => claim.Name == name, TestContext.Current.CancellationToken);
    }

    private async Task<int> RecordCountAsync(Guid key)
    {
        await using var context = database.CreateContext();
        return await context.Set<IdempotencyRecord>().CountAsync(record => record.Key == key, TestContext.Current.CancellationToken);
    }

    private sealed class TestContextFactory(CspsDatabase database, IInterceptor[] hooks) : IDbContextFactory<CspsDbContext>
    {
        public CspsDbContext CreateDbContext() => database.CreateContext(hooks);
    }

    private sealed class GateHandle(CspsDbContext context, IdempotencyGate gate) : IAsyncDisposable
    {
        public IdempotencyGate Gate { get; } = gate;

        public CspsDbContext Context { get; } = context;

        public ValueTask DisposeAsync() => Context.DisposeAsync();
    }

    // Runs a step before each ExecuteUpdate or ExecuteDelete whose SQL starts with the verb; the step may throw.
    private sealed class NonQueryHook(string verb, Func<Task> step) : DbCommandInterceptor
    {
        public override async ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.TrimStart().StartsWith(verb, StringComparison.OrdinalIgnoreCase))
            {
                await step();
            }

            return result;
        }
    }

    // A rollback that fails, as on a broken connection.
    private sealed class FailingRollback : DbTransactionInterceptor
    {
        public override ValueTask<InterceptionResult> TransactionRollingBackAsync(
            DbTransaction transaction, TransactionEventData eventData, InterceptionResult result, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("The rollback failed.");
    }
}
