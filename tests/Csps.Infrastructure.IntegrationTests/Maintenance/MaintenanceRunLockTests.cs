using Csps.Application.Maintenance;
using Csps.Infrastructure.Maintenance;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Maintenance;

/// <summary>JOB-01, T-09-17: the run lease is one DatabaseLocks claim; a held lease refuses a second run and an expired one is taken over.</summary>
public sealed class MaintenanceRunLockTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string LockName = "maintenance-run";

    private static readonly DateTimeOffset Now = new(2026, 11, 3, 12, 0, 0, TimeSpan.Zero);
    private static readonly TimeSpan Lease = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan Patience = TimeSpan.FromSeconds(20);

    [Fact]
    public async Task ASecondTakeWhileTheLeaseIsHeldIsRefused()
    {
        await ClearAsync();
        var runLock = NewLock();
        var first = Guid.NewGuid();

        (await runLock.TryTakeAsync(first, Now, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await runLock.TryTakeAsync(Guid.NewGuid(), Now + TimeSpan.FromMinutes(1), TestContext.Current.CancellationToken)).ShouldBeFalse();

        (await ReadHolderAsync()).ShouldBe(first);
    }

    [Fact]
    public async Task TheLeaseLastsTenMinutes()
    {
        await ClearAsync();

        await NewLock().TryTakeAsync(Guid.NewGuid(), Now, TestContext.Current.CancellationToken);

        (await ReadExpiryAsync()).ShouldBe(Now + Lease);
    }

    [Fact]
    public void TheLeaseOutlastsTheWorstCaseRun()
    {
        // The 90 second pass budget is checked only between rows, so a row can start at its edge: three storage tries of 60 seconds
        // plus the 2 and 8 second waits, then the usage call of up to 60 seconds that runs whatever the budget.
        var worstCase = MaintenanceBudget.DefaultDuration + (3 * TimeSpan.FromSeconds(60)) + TimeSpan.FromSeconds(10) + TimeSpan.FromSeconds(60);

        MaintenanceRunLock.Lease.ShouldBeGreaterThan(worstCase);
    }

    [Fact]
    public async Task ALeaseOneTickBeforeItsExpiryStillHoldsAndAtItsExpiryIsTakenOver()
    {
        await ClearAsync();
        var runLock = NewLock();
        await runLock.TryTakeAsync(Guid.NewGuid(), Now, TestContext.Current.CancellationToken);

        (await runLock.TryTakeAsync(Guid.NewGuid(), Now + Lease - TimeSpan.FromTicks(1), TestContext.Current.CancellationToken)).ShouldBeFalse();

        var second = Guid.NewGuid();
        (await runLock.TryTakeAsync(second, Now + Lease, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await ReadHolderAsync()).ShouldBe(second);
        (await ReadExpiryAsync()).ShouldBe(Now + Lease + Lease);
    }

    [Fact]
    public async Task AReleaseByAnotherHolderDoesNothingAndTheHoldersReleaseFreesTheLease()
    {
        await ClearAsync();
        var runLock = NewLock();
        var holder = Guid.NewGuid();
        await runLock.TryTakeAsync(holder, Now, TestContext.Current.CancellationToken);

        await runLock.ReleaseAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);
        (await ReadHolderAsync()).ShouldBe(holder);
        (await runLock.TryTakeAsync(Guid.NewGuid(), Now, TestContext.Current.CancellationToken)).ShouldBeFalse();

        await runLock.ReleaseAsync(holder, TestContext.Current.CancellationToken);
        (await ReadHolderAsync()).ShouldBeNull();
        (await runLock.TryTakeAsync(Guid.NewGuid(), Now, TestContext.Current.CancellationToken)).ShouldBeTrue();
    }

    [Fact]
    public async Task TwoTakesAtOnceGiveOneWinnerEveryRound()
    {
        for (var round = 0; round < 25; round++)
        {
            await ClearAsync();
            var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var takes = Enumerable.Range(0, 2).Select(_ => Task.Run(async () =>
            {
                await gate.Task.ConfigureAwait(false);
                return await NewLock().TryTakeAsync(Guid.NewGuid(), Now, TestContext.Current.CancellationToken).ConfigureAwait(false);
            })).ToArray();
            gate.SetResult();

            var outcomes = await Task.WhenAll(takes).WaitAsync(Patience, TestContext.Current.CancellationToken);

            outcomes.Count(static won => won).ShouldBe(1);
        }
    }

    [Fact]
    public async Task TwoTakesAtOnceOverAnExpiredLeaseGiveOneWinnerEveryRound()
    {
        for (var round = 0; round < 25; round++)
        {
            await ClearAsync();
            await NewLock().TryTakeAsync(Guid.NewGuid(), Now - TimeSpan.FromMinutes(10), TestContext.Current.CancellationToken);
            var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var takes = Enumerable.Range(0, 2).Select(_ => Task.Run(async () =>
            {
                await gate.Task.ConfigureAwait(false);
                return await NewLock().TryTakeAsync(Guid.NewGuid(), Now, TestContext.Current.CancellationToken).ConfigureAwait(false);
            })).ToArray();
            gate.SetResult();

            var outcomes = await Task.WhenAll(takes).WaitAsync(Patience, TestContext.Current.CancellationToken);

            outcomes.Count(static won => won).ShouldBe(1);
        }
    }

    private MaintenanceRunLock NewLock() => new(new TestContextFactory(database));

    private async Task ClearAsync()
    {
        await using var context = database.CreateContext();
        await context.Set<DatabaseLock>().Where(claim => claim.Name == LockName).ExecuteDeleteAsync(TestContext.Current.CancellationToken);
    }

    private async Task<Guid?> ReadHolderAsync()
    {
        await using var context = database.CreateContext();
        return await context.Set<DatabaseLock>().AsNoTracking()
            .Where(claim => claim.Name == LockName)
            .Select(claim => claim.HolderId)
            .SingleOrDefaultAsync(TestContext.Current.CancellationToken);
    }

    private async Task<DateTimeOffset?> ReadExpiryAsync()
    {
        await using var context = database.CreateContext();
        return await context.Set<DatabaseLock>().AsNoTracking()
            .Where(claim => claim.Name == LockName)
            .Select(claim => claim.ExpiresAtUtc)
            .SingleOrDefaultAsync(TestContext.Current.CancellationToken);
    }

    private sealed class TestContextFactory(CspsDatabase database) : IDbContextFactory<CspsDbContext>
    {
        public CspsDbContext CreateDbContext() => database.CreateContext();
    }
}
