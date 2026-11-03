using Csps.Application.Maintenance;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Maintenance;

/// <summary>JOB-01: the runner orders jobs, gathers their lines, and reports ok and more from them.</summary>
public sealed class RunMaintenanceHandlerTests
{
    [Fact]
    public async Task JobsRunByOrderThenByNameWhateverTheyWereGiven()
    {
        var ran = new List<string>();
        var handler = Handler([Job("c", 20, ran), Job("b", 10, ran), Job("a", 10, ran), Job("d", 40, ran)], new FakeTimeProvider());

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
        var handler = Handler(
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
        var handler = Handler([], new FakeTimeProvider());

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
        var handler = Handler([new ProbeJob(10, "first", clock, seen, TimeSpan.Zero), new ProbeJob(20, "second", clock, seen, MaintenanceBudget.DefaultDuration)], clock);

        await handler.HandleAsync(TestContext.Current.CancellationToken);

        seen.ShouldBe([false, true]);
    }

    [Fact]
    public async Task ALeaseThatIsTakenAnswersTheRunningConflictAndRunsNoJob()
    {
        var ran = new List<string>();
        var runLock = Substitute.For<IMaintenanceRunLock>();
        runLock.TryTakeAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).Returns(false);
        var handler = Handler([Job("a", 10, ran)], new FakeTimeProvider(), runLock);

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeFalse();
        result.Error.ShouldBe(MaintenanceErrors.Running);
        result.Error.Kind.ShouldBe(ErrorKind.Conflict);
        result.Error.Code.ShouldBe("maintenance.running");
        result.Error.Message.ShouldBe("A maintenance run is already going. Try again in a few minutes.");
        ran.ShouldBeEmpty();
        await runLock.DidNotReceive().ReleaseAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheLeaseIsTakenWithTheClockTimeBeforeAnyJobAndReleasedByTheSameHolderAfterTheRun()
    {
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 11, 3, 12, 0, 0, TimeSpan.Zero));
        var order = new List<string>();
        Guid? taken = null;
        var runLock = Substitute.For<IMaintenanceRunLock>();
        runLock.TryTakeAsync(Arg.Any<Guid>(), clock.GetUtcNow(), Arg.Any<CancellationToken>()).Returns(call =>
        {
            taken = call.Arg<Guid>();
            order.Add("take");
            return true;
        });
        runLock.ReleaseAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(call =>
        {
            order.Add("release:" + (call.Arg<Guid>() == taken));
            return Task.CompletedTask;
        });
        var handler = Handler([Job("a", 10, order)], clock, runLock);

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        taken.ShouldNotBeNull().ShouldNotBe(Guid.Empty);
        order.ShouldBe(["take", "a", "release:True"]);
    }

    [Fact]
    public async Task TheLeaseIsReleasedWhenTheRunIsCancelled()
    {
        using var cancel = new CancellationTokenSource();
        var runLock = Substitute.For<IMaintenanceRunLock>();
        runLock.TryTakeAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).Returns(true);
        var handler = Handler([new CancellingJob(cancel)], new FakeTimeProvider(), runLock);

        await Should.ThrowAsync<OperationCanceledException>(() => handler.HandleAsync(cancel.Token));

        await runLock.Received(1).ReleaseAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    private static RunMaintenanceHandler Handler(IEnumerable<IMaintenanceJob> jobs, TimeProvider clock, IMaintenanceRunLock? runLock = null, IMaintenanceJobLog? log = null)
    {
        if (runLock is null)
        {
            runLock = Substitute.For<IMaintenanceRunLock>();
            runLock.TryTakeAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).Returns(true);
        }

        return new RunMaintenanceHandler(jobs, clock, runLock, log ?? Substitute.For<IMaintenanceJobLog>());
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

    private sealed class CancellingJob(CancellationTokenSource cancel) : IMaintenanceJob
    {
        public int Order => 10;

        public string Name => "cancelling";

        public Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken)
        {
            cancel.Cancel();
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(new MaintenanceJobReport([], false));
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
