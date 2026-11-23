using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Expenses;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Csps.Infrastructure.QuoteRequests;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.QuoteRequests;

/// <summary>INQ-03, D-37: the quote request lock answers "busy" for a real timeout only, keeps and logs the cause, treats a deadlock as a lost race, and fails loudly when its row is missing.</summary>
public sealed class QuoteRequestStoreLockTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 22, 10, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task ALockHeldByAnotherTransactionTimesOutAsBusyWithTheTimeoutAsTheCauseAndOneWarning()
    {
        await database.ResetAsync();
        await using var holder = database.CreateContext();
        await using var waiter = database.CreateContext();
        var held = await holder.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (held)
        {
            await NewStore(holder, new FakeLogger<QuoteRequestStore>()).LockAsync(TestContext.Current.CancellationToken);
            var other = await waiter.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
            await using (other)
            {
                var logger = new FakeLogger<QuoteRequestStore>();

                var busy = await Should.ThrowAsync<QuoteRequestsBusyException>(() => NewStore(waiter, logger).LockAsync(TestContext.Current.CancellationToken));

                busy.Message.ShouldBe("Something changed at the same time. Try again.");
                SqlErrors.Has(busy, SqlErrors.Timeout).ShouldBeTrue("the SQL timeout must travel as the cause");
                var warning = logger.Collector.GetSnapshot().ShouldHaveSingleItem();
                warning.Level.ShouldBe(LogLevel.Warning);
                warning.Exception.ShouldNotBeNull();
                warning.Message.ShouldContain("quote-requests");
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
            await context.Set<DatabaseLock>().Where(row => row.Name == DatabaseLocks.QuoteRequests).ExecuteDeleteAsync(TestContext.Current.CancellationToken);
            var logger = new FakeLogger<QuoteRequestStore>();

            var error = await Should.ThrowAsync<InvalidOperationException>(() => NewStore(context, logger).LockAsync(TestContext.Current.CancellationToken));

            error.ShouldBeOfType<DatabaseLockMissingException>();
            error.ShouldNotBeOfType<QuoteRequestsBusyException>();
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
            var logger = new FakeLogger<QuoteRequestStore>();

            await NewStore(context, logger).LockAsync(TestContext.Current.CancellationToken);

            logger.Collector.Count.ShouldBe(0);
            await transaction.RollbackAsync(TestContext.Current.CancellationToken);
        }
    }

    // A deadlock on the lock inside an outer transaction rolls that whole transaction back, so the caller must get the lost race, not a
    // failed rollback to a savepoint that is gone (the 500).
    [Fact]
    public async Task ADeadlockOnTheLockInsideAnOuterTransactionIsALostRaceWithTheTransactionEnded()
    {
        await database.ResetAsync();
        var categoryId = await SaveCategoryAsync($"Qr {Guid.NewGuid():N}"[..24]);
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
            // The victim holds the category row; the holder holds the quote-requests row and writes more, so SQL Server ends the victim.
            victimCategory.Rename($"Qr A {Guid.NewGuid():N}"[..24]).IsSuccess.ShouldBeTrue();
            await victimUnit.SaveChangesAsync(TestContext.Current.CancellationToken);
            await NewStore(holder, new FakeLogger<QuoteRequestStore>()).LockAsync(TestContext.Current.CancellationToken);
            for (var index = 0; index < 20; index++)
            {
                holder.ExpenseCategories.Add(ExpenseCategory.Create($"Qr F {Guid.NewGuid():N}"[..24], CategoryTones.Info, Now).Value);
            }

            await holderUnit.SaveChangesAsync(TestContext.Current.CancellationToken);

            // The lock wait outlasts SQL Server's deadlock check, so the wait ends as a deadlock, not a timeout.
            var victimStore = new QuoteRequestStore(victim, new FakeTimeProvider(Now), new FakeLogger<QuoteRequestStore>(), TimeSpan.FromSeconds(30));
            var outcomes = await Task.WhenAll(
                CaptureAsync(() => victimUnit.InTransactionAsync(
                    async token =>
                    {
                        await victimStore.LockAsync(token);
                        return 0;
                    },
                    TestContext.Current.CancellationToken)),
                CaptureAsync(() => holderUnit.InTransactionAsync(
                    async token =>
                    {
                        holderCategory.Rename($"Qr B {Guid.NewGuid():N}"[..24]).IsSuccess.ShouldBeTrue();
                        return await holderUnit.SaveChangesAsync(token);
                    },
                    TestContext.Current.CancellationToken)));

            var lost = outcomes[0].ShouldBeOfType<ConcurrencyConflictException>(outcomes[0]?.ToString());
            lost.OuterTransactionEnded.ShouldBeTrue();
            SqlErrors.Has(lost, SqlErrors.DeadlockVictim).ShouldBeTrue("the deadlock must travel as the cause");
            outcomes[1].ShouldBeNull(outcomes[1]?.ToString());
        }
    }

    private static QuoteRequestStore NewStore(CspsDbContext context, FakeLogger<QuoteRequestStore> logger) =>
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
