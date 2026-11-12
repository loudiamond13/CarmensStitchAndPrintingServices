using Csps.Domain.Expenses;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>What happened to the two requests of a lock deadlock, and what the victim's change tracker held afterwards.</summary>
/// <param name="Victim">The error the victim ended with, or null.</param>
/// <param name="Holder">The error the lock holder ended with, or null.</param>
/// <param name="VictimTrackedEntries">How many entities the victim's context still tracked.</param>
internal sealed record LockDeadlockOutcome(Exception? Victim, Exception? Holder, int VictimTrackedEntries);

/// <summary>
/// P10-BL-22: makes a real deadlock on a standing lock row inside an outer transaction, as the idempotency gate opens one. The victim
/// holds a category row, then waits for the lock; the holder takes the lock first and then reaches for the category row.
/// </summary>
internal static class LockDeadlockScenario
{
    private static readonly DateTimeOffset Now = new(2026, 11, 11, 12, 0, 0, TimeSpan.Zero);

    /// <summary>Runs the deadlock and returns what each request ended with.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="takeLock">Takes the lock under test on the given context, inside the open transaction.</param>
    /// <returns>The two outcomes.</returns>
    public static async Task<LockDeadlockOutcome> RunAsync(CspsDatabase database, Func<CspsDbContext, CancellationToken, Task> takeLock)
    {
        ArgumentNullException.ThrowIfNull(database);
        ArgumentNullException.ThrowIfNull(takeLock);

        await database.ResetAsync();
        var categoryId = await SaveCategoryAsync(database, $"Lk {Guid.NewGuid():N}"[..24]);
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
            // The victim holds the category row; the holder holds the lock row and writes more, so SQL Server ends the victim.
            victimCategory.Rename($"Lk A {Guid.NewGuid():N}"[..24]).IsSuccess.ShouldBeTrue();
            await victimUnit.SaveChangesAsync(TestContext.Current.CancellationToken);
            await takeLock(holder, TestContext.Current.CancellationToken);
            for (var index = 0; index < 20; index++)
            {
                holder.ExpenseCategories.Add(ExpenseCategory.Create($"Lk F {Guid.NewGuid():N}"[..24], CategoryTones.Info, Now).Value);
            }

            await holderUnit.SaveChangesAsync(TestContext.Current.CancellationToken);

            using var limit = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
            limit.CancelAfter(TimeSpan.FromSeconds(60));
            var outcomes = await Task.WhenAll(
                CaptureAsync(() => victimUnit.InTransactionAsync(
                    async token =>
                    {
                        await takeLock(victim, token);
                        return 0;
                    },
                    limit.Token)),
                CaptureAsync(() => holderUnit.InTransactionAsync(
                    async token =>
                    {
                        holderCategory.Rename($"Lk B {Guid.NewGuid():N}"[..24]).IsSuccess.ShouldBeTrue();
                        return await holderUnit.SaveChangesAsync(token);
                    },
                    limit.Token)));

            return new LockDeadlockOutcome(outcomes[0], outcomes[1], victim.ChangeTracker.Entries().Count());
        }
    }

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

    private static async Task<Guid> SaveCategoryAsync(CspsDatabase database, string name)
    {
        var category = ExpenseCategory.Create(name, CategoryTones.Info, Now).Value;
        await using var context = database.CreateContext();
        context.ExpenseCategories.Add(category);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return category.Id;
    }
}
