using System.Security.Cryptography;
using Csps.Infrastructure.Idempotency;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

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

    private static byte[] Hash() => RandomNumberGenerator.GetBytes(32);

    private GateHandle NewGate()
    {
        var context = database.CreateContext();
        return new GateHandle(context, new IdempotencyGate(context, new TestContextFactory(database), NullLogger<IdempotencyGate>.Instance));
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

    private sealed class TestContextFactory(CspsDatabase database) : IDbContextFactory<CspsDbContext>
    {
        public CspsDbContext CreateDbContext() => database.CreateContext();
    }

    private sealed class GateHandle(CspsDbContext context, IdempotencyGate gate) : IAsyncDisposable
    {
        public IdempotencyGate Gate { get; } = gate;

        public ValueTask DisposeAsync() => context.DisposeAsync();
    }
}
