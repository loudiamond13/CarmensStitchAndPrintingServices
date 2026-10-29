using Csps.Application.Common;
using Csps.Domain.Expenses;
using Csps.Infrastructure.Idempotency;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// APO-WR-01, D-46: every order write runs inside the idempotency gate's transaction, so its attempt runs in a savepoint. When SQL
/// Server picks that request as the deadlock victim it rolls back the whole transaction, so there is no savepoint to go back to.
/// The caller must still get a lost-race error (the 409), not a failure from the rollback (the 500), and the gate must still be
/// able to end its lease.
/// </summary>
public sealed class DeadlockInsideAnOuterTransactionTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task ADeadlockVictimInASavepointAttemptIsALostRaceAndTheOtherAttemptGoesThrough()
    {
        await using var contextOne = database.CreateContext();
        var outcomes = await RunDeadlockAsync(contextOne);

        outcomes.Count(static outcome => outcome is ConcurrencyConflictException).ShouldBe(1, Describe(outcomes));
        outcomes.Count(static outcome => outcome is null).ShouldBe(1, Describe(outcomes));
    }

    [Fact]
    public async Task TheGateCanEndItsLeaseAfterItsRequestWasTheDeadlockVictim()
    {
        var key = Guid.NewGuid();
        await using var gateContext = database.CreateContext();
        var gate = new IdempotencyGate(gateContext, new Factory(database), NullLogger<IdempotencyGate>.Instance);
        await using var lease = await gate.BeginAsync(key, "POST /probe/deadlock", null, new byte[32], Now, TestContext.Current.CancellationToken);
        lease.State.ShouldBe(IdempotencyLeaseState.Proceed);

        var outcomes = await RunDeadlockAsync(gateContext, openOuterTransaction: false);

        outcomes.Count(static outcome => outcome is ConcurrencyConflictException).ShouldBe(1, Describe(outcomes));
        await Should.NotThrowAsync(() => lease.RollbackAsync(TestContext.Current.CancellationToken));
        await using var again = database.CreateContext();
        var next = new IdempotencyGate(again, new Factory(database), NullLogger<IdempotencyGate>.Instance);
        await using var second = await next.BeginAsync(key, "POST /probe/deadlock", null, new byte[32], Now, TestContext.Current.CancellationToken);
        second.State.ShouldBe(IdempotencyLeaseState.Proceed);
    }

    // Two requests each lock one category row, then each attempt reaches for the other's row inside its own savepoint.
    private async Task<Exception?[]> RunDeadlockAsync(CspsDbContext victimCandidate, bool openOuterTransaction = true)
    {
        var firstId = await SaveCategoryAsync($"Sp A {Guid.NewGuid():N}"[..24]);
        var secondId = await SaveCategoryAsync($"Sp B {Guid.NewGuid():N}"[..24]);
        await using var contextTwo = database.CreateContext();
        var oneFirst = await victimCandidate.ExpenseCategories.SingleAsync(row => row.Id == firstId, TestContext.Current.CancellationToken);
        var oneSecond = await victimCandidate.ExpenseCategories.SingleAsync(row => row.Id == secondId, TestContext.Current.CancellationToken);
        var twoFirst = await contextTwo.ExpenseCategories.SingleAsync(row => row.Id == firstId, TestContext.Current.CancellationToken);
        var twoSecond = await contextTwo.ExpenseCategories.SingleAsync(row => row.Id == secondId, TestContext.Current.CancellationToken);
        var unitOne = new CspsUnitOfWork(victimCandidate);
        var unitTwo = new CspsUnitOfWork(contextTwo);
        var transactionOne = openOuterTransaction
            ? await victimCandidate.Database.BeginTransactionAsync(TestContext.Current.CancellationToken)
            : victimCandidate.Database.CurrentTransaction.ShouldNotBeNull();
        var transactionTwo = await contextTwo.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (transactionTwo)
        {
            try
            {
                oneFirst.Rename($"Sp A1 {Guid.NewGuid():N}"[..24]).IsSuccess.ShouldBeTrue();
                await unitOne.SaveChangesAsync(TestContext.Current.CancellationToken);
                twoSecond.Rename($"Sp B1 {Guid.NewGuid():N}"[..24]).IsSuccess.ShouldBeTrue();
                await unitTwo.SaveChangesAsync(TestContext.Current.CancellationToken);

                using var limit = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
                limit.CancelAfter(TimeSpan.FromSeconds(60));
                return await Task.WhenAll(
                    CaptureAsync(() => unitOne.InTransactionAsync(
                        async token =>
                        {
                            oneSecond.Rename($"Sp B2 {Guid.NewGuid():N}"[..24]).IsSuccess.ShouldBeTrue();
                            return await unitOne.SaveChangesAsync(token);
                        },
                        limit.Token)),
                    CaptureAsync(() => unitTwo.InTransactionAsync(
                        async token =>
                        {
                            twoFirst.Rename($"Sp A2 {Guid.NewGuid():N}"[..24]).IsSuccess.ShouldBeTrue();
                            return await unitTwo.SaveChangesAsync(token);
                        },
                        limit.Token)));
            }
            finally
            {
                if (openOuterTransaction)
                {
                    await transactionOne.DisposeAsync();
                }
            }
        }
    }

    private static string Describe(Exception?[] outcomes) =>
        string.Join(" | ", outcomes.Select(static outcome => outcome is null ? "saved" : $"{outcome.GetType().Name}: {outcome.Message}"));

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

    private sealed class Factory(CspsDatabase database) : IDbContextFactory<CspsDbContext>
    {
        public CspsDbContext CreateDbContext() => database.CreateContext();
    }
}
