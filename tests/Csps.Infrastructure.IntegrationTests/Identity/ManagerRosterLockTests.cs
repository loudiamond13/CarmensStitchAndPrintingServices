using Csps.Application.Common;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.IntegrationTests.Persistence;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Identity;

/// <summary>P10-BL-22, D-50: the Manager roster lock ends a lost deadlock as a lost race, like the staff money lock, so no request answers 500.</summary>
public sealed class ManagerRosterLockTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 11, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task ADeadlockOnTheLockInsideAnOuterTransactionIsALostRaceWithTheTransactionEnded()
    {
        var outcome = await LockDeadlockScenario.RunAsync(
            database,
            (context, token) => new ManagerRosterLock(context, new FakeTimeProvider(Now)).LockActiveManagersAsync(token));

        var lost = outcome.Victim.ShouldBeOfType<ConcurrencyConflictException>(outcome.Victim?.ToString());
        lost.OuterTransactionEnded.ShouldBeTrue();
        SqlErrors.Has(lost, SqlErrors.DeadlockVictim).ShouldBeTrue("the deadlock must travel as the cause");
        outcome.VictimTrackedEntries.ShouldBe(0);
        outcome.Holder.ShouldBeNull(outcome.Holder?.ToString());
    }
}
