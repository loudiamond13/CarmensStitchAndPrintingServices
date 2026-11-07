using Csps.Application.Ports;
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

    private static StaffMoneyLock NewLock(CspsDbContext context, FakeLogger<StaffMoneyLock> logger) =>
        new(context, new FakeTimeProvider(Now), logger, TimeSpan.FromSeconds(1));
}
