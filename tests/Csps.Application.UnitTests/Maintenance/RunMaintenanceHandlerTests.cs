using Csps.Application.Maintenance;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Application.UnitTests.Maintenance;

/// <summary>JOB-01: the runner orders jobs, gathers their lines, and reports ok and more from them.</summary>
public sealed class RunMaintenanceHandlerTests
{
    [Fact]
    public async Task JobsRunByOrderThenByNameWhateverTheyWereGiven()
    {
        var ran = new List<string>();
        var handler = new RunMaintenanceHandler(
            [Job("c", 20, ran), Job("b", 10, ran), Job("a", 10, ran), Job("d", 40, ran)],
            new FakeTimeProvider());

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        ran.ShouldBe(["a", "b", "c", "d"]);
        result.Value.Lines.Select(static line => line.Label).ShouldBe(["a", "b", "c", "d"]);
        result.Value.Ok.ShouldBeTrue();
        result.Value.More.ShouldBeFalse();
    }

    [Fact]
    public async Task OneFailedLineMakesTheRunNotOkAndOneJobWithMoreMakesItMore()
    {
        var handler = new RunMaintenanceHandler(
            [
                new StubJob(10, "fine", new MaintenanceJobReport([new MaintenanceLine("fine", 1, false, null)], false)),
                new StubJob(20, "broken", new MaintenanceJobReport([new MaintenanceLine("broken", null, true, "It failed.")], true)),
            ],
            new FakeTimeProvider());

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Ok.ShouldBeFalse();
        result.Value.More.ShouldBeTrue();
        result.Value.Lines.Count.ShouldBe(2);
    }

    [Fact]
    public async Task NoJobsIsAnOkRunWithNoLines()
    {
        var handler = new RunMaintenanceHandler([], new FakeTimeProvider());

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Ok.ShouldBeTrue();
        result.Value.More.ShouldBeFalse();
        result.Value.Lines.ShouldBeEmpty();
    }

    [Fact]
    public async Task EveryJobSharesOneBudgetThatEndsAfterNinetySeconds()
    {
        var clock = new FakeTimeProvider();
        var seen = new List<bool>();
        var handler = new RunMaintenanceHandler(
            [new ProbeJob(10, "first", clock, seen, TimeSpan.Zero), new ProbeJob(20, "second", clock, seen, MaintenanceBudget.DefaultDuration)],
            clock);

        await handler.HandleAsync(TestContext.Current.CancellationToken);

        seen.ShouldBe([false, true]);
    }

    private static StubJob Job(string name, int order, List<string> ran) =>
        new(order, name, new MaintenanceJobReport([new MaintenanceLine(name, 1, false, null)], false), ran);

    private sealed class StubJob(int order, string name, MaintenanceJobReport report, List<string>? ran = null) : IMaintenanceJob
    {
        public int Order => order;

        public string Name => name;

        public Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken)
        {
            ran?.Add(name);
            return Task.FromResult(report);
        }
    }

    // Advances the clock after it looks at the budget, to show that the second job sees the same budget spent.
    private sealed class ProbeJob(int order, string name, FakeTimeProvider clock, List<bool> seen, TimeSpan advanceBefore) : IMaintenanceJob
    {
        public int Order => order;

        public string Name => name;

        public Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken)
        {
            clock.Advance(advanceBefore);
            seen.Add(budget.IsSpent);
            return Task.FromResult(new MaintenanceJobReport([], false));
        }
    }
}
