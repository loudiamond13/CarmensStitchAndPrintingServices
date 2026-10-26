using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>D-50: a lock is a standing row updated with EF inside the caller's transaction and held to its end, so a second taker waits.</summary>
public sealed class DatabaseLocksTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Message = "The test lock could not be taken.";

    private static readonly DateTimeOffset Now = new(2026, 10, 25, 12, 0, 0, TimeSpan.Zero);
    private static readonly TimeSpan Patience = TimeSpan.FromSeconds(10);

    [Fact]
    public async Task ASecondTakerWaitsUntilTheFirstCommitsEveryRound()
    {
        for (var round = 0; round < 30; round++)
        {
            await RunWaitRoundAsync(commit: true);
        }
    }

    [Fact]
    public async Task ASecondTakerWaitsUntilTheFirstRollsBackEveryRound()
    {
        for (var round = 0; round < 30; round++)
        {
            await RunWaitRoundAsync(commit: false);
        }
    }

    [Fact]
    public async Task ADifferentLockDoesNotWait()
    {
        await using var first = database.CreateContext();
        await using var second = database.CreateContext();
        var transaction = await first.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (transaction)
        {
            await TakeAsync(first, DatabaseLocks.ActiveManagers);
            var other = await second.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
            await using (other)
            {
                await TakeAsync(second, "account-token:07").WaitAsync(Patience, TestContext.Current.CancellationToken);
                await other.CommitAsync(TestContext.Current.CancellationToken);
            }

            await transaction.CommitAsync(TestContext.Current.CancellationToken);
        }
    }

    [Fact]
    public async Task TakingTheSameLockTwiceInOneTransactionDoesNotWaitOnItself()
    {
        await using var context = database.CreateContext();
        var transaction = await context.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (transaction)
        {
            await TakeAsync(context, DatabaseLocks.ActiveManagers);
            await TakeAsync(context, DatabaseLocks.ActiveManagers).WaitAsync(Patience, TestContext.Current.CancellationToken);
            await transaction.CommitAsync(TestContext.Current.CancellationToken);
        }
    }

    [Fact]
    public async Task ALockTakenBeforeASavepointIsStillHeldAfterTheRollbackToIt()
    {
        await using var first = database.CreateContext();
        await using var second = database.CreateContext();
        var transaction = await first.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (transaction)
        {
            await TakeAsync(first, DatabaseLocks.ActiveManagers);
            await transaction.CreateSavepointAsync("attempt", TestContext.Current.CancellationToken);
            await transaction.RollbackToSavepointAsync("attempt", TestContext.Current.CancellationToken);

            await AssertSecondTakerWaitsAsync(second, transaction);
        }
    }

    [Fact]
    public async Task ARetriedAttemptTakesTheLockAgainAndHoldsItToTheEnd()
    {
        await using var first = database.CreateContext();
        await using var second = database.CreateContext();
        var transaction = await first.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (transaction)
        {
            await transaction.CreateSavepointAsync("attempt", TestContext.Current.CancellationToken);
            await TakeAsync(first, DatabaseLocks.ActiveManagers);

            // SQL Server frees a lock taken after the savepoint together with the attempt's writes, so the retry takes it again.
            await transaction.RollbackToSavepointAsync("attempt", TestContext.Current.CancellationToken);
            await TakeAsync(first, DatabaseLocks.ActiveManagers);

            await AssertSecondTakerWaitsAsync(second, transaction);
        }
    }

    [Fact]
    public async Task TakingALockWithNoOpenTransactionThrowsAndChangesNothing()
    {
        await using var context = database.CreateContext();
        var before = await ReadTakenAtAsync("account-token:11");

        var error = await Should.ThrowAsync<InvalidOperationException>(() => TakeAsync(context, "account-token:11"));

        error.ShouldNotBeNull();
        (await ReadTakenAtAsync("account-token:11")).ShouldBe(before);
    }

    [Fact]
    public async Task ALockNotHadWithinTheWaitThrowsTheGivenMessage()
    {
        await using var first = database.CreateContext();
        await using var second = database.CreateContext();
        var transaction = await first.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (transaction)
        {
            await TakeAsync(first, DatabaseLocks.ActiveManagers);
            var other = await second.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
            await using (other)
            {
                var error = await Should.ThrowAsync<InvalidOperationException>(
                    () => DatabaseLocks.TakeAsync(second, DatabaseLocks.ActiveManagers, Now, TimeSpan.FromSeconds(1), Message, TestContext.Current.CancellationToken));

                error.Message.ShouldBe(Message);
            }

            await transaction.RollbackAsync(TestContext.Current.CancellationToken);
        }
    }

    [Fact]
    public async Task AnUnknownLockNameThrows()
    {
        await using var context = database.CreateContext();
        var transaction = await context.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (transaction)
        {
            var error = await Should.ThrowAsync<InvalidOperationException>(() => TakeAsync(context, "no-such-lock"));

            error.Message.ShouldBe(Message);
        }
    }

    [Fact]
    public void AnAccountAlwaysMapsToTheSameOneOfTheSixtyFourLocks()
    {
        var id = Guid.NewGuid();
        var name = DatabaseLocks.AccountStripe(id);

        DatabaseLocks.AccountStripe(id).ShouldBe(name);
        DatabaseLocks.StandingNames.ShouldContain(name);
        name.ShouldStartWith("account-token:");
    }

    [Fact]
    public void RandomAccountsReachAllSixtyFourLocks()
    {
        var reached = new HashSet<string>(StringComparer.Ordinal);
        for (var index = 0; index < 10_000; index++)
        {
            var name = DatabaseLocks.AccountStripe(Guid.NewGuid());
            DatabaseLocks.StandingNames.ShouldContain(name);
            reached.Add(name);
        }

        reached.Count.ShouldBe(DatabaseLocks.AccountStripeCount);
    }

    [Fact]
    public async Task TheManagerRosterLockTakesTheActiveManagersRow()
    {
        await using var first = database.CreateContext();
        await using var second = database.CreateContext();
        var rosterLock = new ManagerRosterLock(first, new FakeTimeProvider(Now));
        var transaction = await first.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (transaction)
        {
            await rosterLock.LockActiveManagersAsync(TestContext.Current.CancellationToken);

            var other = await second.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
            await using (other)
            {
                var taking = TakeAsync(second, DatabaseLocks.ActiveManagers);
                await Task.Delay(TimeSpan.FromMilliseconds(250), TestContext.Current.CancellationToken);
                taking.IsCompleted.ShouldBeFalse();

                await transaction.CommitAsync(TestContext.Current.CancellationToken);
                await taking.WaitAsync(Patience, TestContext.Current.CancellationToken);
                await other.CommitAsync(TestContext.Current.CancellationToken);
            }
        }
    }

    private static async Task AssertSecondTakerWaitsAsync(CspsDbContext second, IDbContextTransaction holder)
    {
        var other = await second.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (other)
        {
            var taking = TakeAsync(second, DatabaseLocks.ActiveManagers);
            await Task.Delay(TimeSpan.FromMilliseconds(250), TestContext.Current.CancellationToken);
            taking.IsCompleted.ShouldBeFalse("the second taker must wait for the first transaction to end");

            await holder.CommitAsync(TestContext.Current.CancellationToken);
            await taking.WaitAsync(Patience, TestContext.Current.CancellationToken);
            await other.CommitAsync(TestContext.Current.CancellationToken);
        }
    }

    private static Task TakeAsync(CspsDbContext context, string name) =>
        DatabaseLocks.TakeAsync(context, name, Now, DatabaseLocks.DefaultWait, Message, TestContext.Current.CancellationToken);

    private async Task RunWaitRoundAsync(bool commit)
    {
        await using var first = database.CreateContext();
        await using var second = database.CreateContext();
        var transaction = await first.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (transaction)
        {
            await TakeAsync(first, DatabaseLocks.ActiveManagers);

            var other = await second.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
            await using (other)
            {
                var taking = TakeAsync(second, DatabaseLocks.ActiveManagers);
                await Task.Delay(TimeSpan.FromMilliseconds(250), TestContext.Current.CancellationToken);
                taking.IsCompleted.ShouldBeFalse("the second taker must wait for the first transaction to end");

                if (commit)
                {
                    await transaction.CommitAsync(TestContext.Current.CancellationToken);
                }
                else
                {
                    await transaction.RollbackAsync(TestContext.Current.CancellationToken);
                }

                await taking.WaitAsync(Patience, TestContext.Current.CancellationToken);
                await other.CommitAsync(TestContext.Current.CancellationToken);
            }
        }
    }

    private async Task<DateTimeOffset?> ReadTakenAtAsync(string name)
    {
        await using var context = database.CreateContext();
        return await context.Set<DatabaseLock>().AsNoTracking().Where(row => row.Name == name).Select(row => row.TakenAtUtc).SingleAsync(TestContext.Current.CancellationToken);
    }
}
