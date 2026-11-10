using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Expenses;
using Csps.Infrastructure.Money;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Money;

/// <summary>MONEY-05, D-53: the staff money lock answers "busy" for a real timeout only, keeps and logs the cause, and fails loudly when its row is missing.</summary>
public sealed class StaffMoneyLockTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task ALockHeldByAnotherTransactionGivesBusyWithTheTimeoutAsTheCauseAndOneWarning()
    {
        await database.ResetAsync();
        await using var holder = database.CreateContext();
        await using var waiter = database.CreateContext();
        var held = await holder.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (held)
        {
            await NewLock(holder, new FakeLogger<StaffMoneyLock>()).LockAsync(TestContext.Current.CancellationToken);
            var other = await waiter.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
            await using (other)
            {
                var logger = new FakeLogger<StaffMoneyLock>();

                var busy = await Should.ThrowAsync<StaffMoneyBusyException>(() => NewLock(waiter, logger).LockAsync(TestContext.Current.CancellationToken));

                SqlErrors.Has(busy, SqlErrors.Timeout).ShouldBeTrue("the SQL timeout must travel as the cause");
                var warning = logger.Collector.GetSnapshot().ShouldHaveSingleItem();
                warning.Level.ShouldBe(LogLevel.Warning);
                warning.Exception.ShouldNotBeNull();
                SqlErrors.Has(warning.Exception, SqlErrors.Timeout).ShouldBeTrue();
                warning.Message.ShouldContain("staff-money");
            }

            await held.RollbackAsync(TestContext.Current.CancellationToken);
        }
    }

    [Fact]
    public async Task AMissingLockRowFailsClearlyAndIsNeverReadAsBusy()
    {
        await database.ResetAsync();
        await using var context = database.CreateContext();
        var transaction = await context.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (transaction)
        {
            await context.Set<DatabaseLock>().Where(row => row.Name == DatabaseLocks.StaffMoney).ExecuteDeleteAsync(TestContext.Current.CancellationToken);
            var logger = new FakeLogger<StaffMoneyLock>();

            var error = await Should.ThrowAsync<InvalidOperationException>(() => NewLock(context, logger).LockAsync(TestContext.Current.CancellationToken));

            error.ShouldBeOfType<DatabaseLockMissingException>();
            error.ShouldNotBeOfType<StaffMoneyBusyException>();
            error.Message.ShouldContain("staff-money");
            logger.Collector.Count.ShouldBe(0);
            await transaction.RollbackAsync(TestContext.Current.CancellationToken);
        }
    }

    [Fact]
    public async Task AFreeLockIsTakenWithoutALogLine()
    {
        await database.ResetAsync();
        await using var context = database.CreateContext();
        var transaction = await context.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (transaction)
        {
            var logger = new FakeLogger<StaffMoneyLock>();

            await NewLock(context, logger).LockAsync(TestContext.Current.CancellationToken);

            logger.Collector.Count.ShouldBe(0);
            await transaction.RollbackAsync(TestContext.Current.CancellationToken);
        }
    }

    // D-46: a money create runs inside the idempotency gate's transaction. A deadlock on the lock rolls that whole transaction back,
    // so the caller must get the lost race (the 409), not a failed rollback to a savepoint that is gone (the 500).
    [Fact]
    public async Task ADeadlockOnTheLockInsideAnOuterTransactionIsALostRaceWithTheTransactionEnded()
    {
        await database.ResetAsync();
        var categoryId = await SaveCategoryAsync($"Lk {Guid.NewGuid():N}"[..24]);
        await using var victim = database.CreateContext();
        await using var holder = database.CreateContext();
        var victimCategory = await victim.ExpenseCategories.SingleAsync(row => row.Id == categoryId, TestContext.Current.CancellationToken);
        var holderCategory = await holder.ExpenseCategories.SingleAsync(row => row.Id == categoryId, TestContext.Current.CancellationToken);
        var victimUnit = new CspsUnitOfWork(victim);
        var holderUnit = new CspsUnitOfWork(holder);
        var victimOuter = await victim.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        var holderOuter = await holder.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (victimOuter)
        await using (holderOuter)
        {
            // The victim holds the category row; the holder holds the staff-money row and writes more, so SQL Server ends the victim.
            victimCategory.Rename($"Lk A {Guid.NewGuid():N}"[..24]).IsSuccess.ShouldBeTrue();
            await victimUnit.SaveChangesAsync(TestContext.Current.CancellationToken);
            await NewLock(holder, new FakeLogger<StaffMoneyLock>()).LockAsync(TestContext.Current.CancellationToken);
            for (var index = 0; index < 20; index++)
            {
                holder.ExpenseCategories.Add(ExpenseCategory.Create($"Lk F {Guid.NewGuid():N}"[..24], CategoryTones.Info, Now).Value);
            }

            await holderUnit.SaveChangesAsync(TestContext.Current.CancellationToken);

            // The lock wait outlasts SQL Server's deadlock check, so the wait ends as a deadlock, not a timeout.
            var victimLock = new StaffMoneyLock(victim, new FakeTimeProvider(Now), new FakeLogger<StaffMoneyLock>(), TimeSpan.FromSeconds(30));
            var outcomes = await Task.WhenAll(
                CaptureAsync(() => victimUnit.InTransactionAsync(
                    async token =>
                    {
                        await victimLock.LockAsync(token);
                        return 0;
                    },
                    TestContext.Current.CancellationToken)),
                CaptureAsync(() => holderUnit.InTransactionAsync(
                    async token =>
                    {
                        holderCategory.Rename($"Lk B {Guid.NewGuid():N}"[..24]).IsSuccess.ShouldBeTrue();
                        return await holderUnit.SaveChangesAsync(token);
                    },
                    TestContext.Current.CancellationToken)));

            var lost = outcomes[0].ShouldBeOfType<ConcurrencyConflictException>(outcomes[0]?.ToString());
            lost.OuterTransactionEnded.ShouldBeTrue();
            SqlErrors.Has(lost, SqlErrors.DeadlockVictim).ShouldBeTrue("the deadlock must travel as the cause");
            outcomes[1].ShouldBeNull(outcomes[1]?.ToString());
        }
    }

    private static StaffMoneyLock NewLock(CspsDbContext context, FakeLogger<StaffMoneyLock> logger) =>
        new(context, new FakeTimeProvider(Now), logger, TimeSpan.FromSeconds(1));

    private static async Task<Exception?> CaptureAsync(Func<Task<int>> work)
    {
        try
        {
            await work();
            return null;
        }
        catch (Exception error)
        {
            return error;
        }
    }

    private async Task<Guid> SaveCategoryAsync(string name)
    {
        var category = ExpenseCategory.Create(name, CategoryTones.Info, Now).Value;
        await using var context = database.CreateContext();
        context.ExpenseCategories.Add(category);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return category.Id;
    }
}
