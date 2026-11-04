using System.Collections.Concurrent;
using Csps.Application.Maintenance;
using Csps.Application.Ports;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Maintenance;

/// <summary>
/// JOB-02, D-05, D-22: the removal job works the queue with a lease per row, retries a transient failure with growing waits, keeps a
/// row that keeps failing and turns the run red, and stops at once when the storage refuses the keys.
/// </summary>
public sealed class ImageRemovalJobTests
{
    private const string RemovedLabel = "Photos removed from storage";
    private const string FailingLabel = "Photo removals still failing";
    private const string KeysRefusedText = "Cloudinary refused the keys. Check the Cloudinary settings.";

    private static readonly ImageRemovalOutcome Removed = new(ImageRemovalStatus.Removed);
    private static readonly ImageRemovalOutcome NotFound = new(ImageRemovalStatus.NotFound);
    private static readonly ImageRemovalOutcome Transient = new(ImageRemovalStatus.Transient, "transient");
    private static readonly ImageRemovalOutcome Unauthorized = new(ImageRemovalStatus.Rejected, "unauthorized");
    private static readonly ImageRemovalOutcome Refused = new(ImageRemovalStatus.Rejected, "refused");

    private static string PublicId(int number) => $"csps-test/orders/00000000-0000-0000-0000-000000000001/photo{number:D3}";

    [Fact]
    public void TheJobRunsThirdInThePassAsOrder30()
    {
        var harness = new Harness();

        harness.Job.Order.ShouldBe(30);
        harness.Job.Name.ShouldBe("image-removal");
    }

    [Fact]
    public async Task EveryDueRowIsRemovedAndDeletedAndCounted()
    {
        var harness = new Harness();
        harness.Queue.Add(PublicId(1));
        harness.Queue.Add(PublicId(2));
        harness.Queue.Add(PublicId(3));

        var report = await harness.RunAsync();

        report.More.ShouldBeFalse();
        var line = report.Lines.ShouldHaveSingleItem();
        (line.Label, line.Value, line.Failed).ShouldBe((RemovedLabel, 3L, false));
        harness.Queue.Rows.ShouldBeEmpty();
        harness.Storage.Removals.ShouldBe([PublicId(1), PublicId(2), PublicId(3)]);
    }

    [Fact]
    public async Task MoreThanOneBatchOfDueRowsAreAllRemoved()
    {
        var harness = new Harness();
        for (var number = 1; number <= 30; number++)
        {
            harness.Queue.Add(PublicId(number));
        }

        var report = await harness.RunAsync();

        report.Lines.ShouldHaveSingleItem().Value.ShouldBe(30);
        harness.Queue.Rows.ShouldBeEmpty();
        harness.Queue.Claims.ShouldBe(2);
    }

    [Fact]
    public async Task ARunWithNothingQueuedReportsZeroAndIsOk()
    {
        var harness = new Harness();

        var report = await harness.RunAsync();

        var line = report.Lines.ShouldHaveSingleItem();
        (line.Label, line.Value, line.Failed).ShouldBe((RemovedLabel, 0L, false));
    }

    [Fact]
    public async Task ATransientAnswerThenRemovedWaitsTwoSecondsAndRemovesTheFile()
    {
        var harness = new Harness();
        harness.Queue.Add(PublicId(1));
        harness.Storage.Script(Transient, Removed);

        var report = await harness.RunAsync();

        harness.Storage.Removals.Count.ShouldBe(2);
        harness.Time.Delays.ShouldBe([TimeSpan.FromSeconds(2)]);
        harness.Queue.Rows.ShouldBeEmpty();
        var line = report.Lines.ShouldHaveSingleItem();
        (line.Label, line.Value, line.Failed).ShouldBe((RemovedLabel, 1L, false));
    }

    [Fact]
    public async Task ATransientAnswerThreeTimesWaitsTwoThenEightSecondsKeepsTheRowAndTurnsTheRunRed()
    {
        var harness = new Harness();
        var row = harness.Queue.Add(PublicId(1));
        harness.Storage.Script(Transient, Transient, Transient);

        var report = await harness.RunAsync();

        harness.Storage.Removals.Count.ShouldBe(3);
        harness.Time.Delays.ShouldBe([TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(8)]);
        row.Attempts.ShouldBe(1);
        row.LastFailureCode.ShouldBe("transient");
        row.LeaseHolder.ShouldBeNull();
        var failing = report.Lines.Single(line => line.Failed);
        (failing.Label, failing.Value).ShouldBe((FailingLabel, 1L));
        report.Lines.Single(line => line.Label == RemovedLabel).Value.ShouldBe(0);
        harness.Log.Received(1).RemovalFailed(row.Id, "transient");
    }

    [Fact]
    public async Task ARowThatFailedOnceIsNotTakenAgainInTheSameRun()
    {
        var harness = new Harness();
        for (var number = 1; number <= 26; number++)
        {
            harness.Queue.Add(PublicId(number));
        }

        harness.Storage.Script(Refused);

        var report = await harness.RunAsync();

        harness.Storage.Removals.Count.ShouldBe(26);
        harness.Queue.Rows.ShouldHaveSingleItem().PublicId.ShouldBe(PublicId(1));
        report.Lines.Single(line => line.Label == RemovedLabel).Value.ShouldBe(25);
        report.Lines.Single(line => line.Failed).Value.ShouldBe(1);
    }

    [Fact]
    public async Task ARefusedAnswerIsNotRetriedAndIsRecordedWithItsCode()
    {
        var harness = new Harness();
        var row = harness.Queue.Add(PublicId(1));
        harness.Storage.Script(Refused);

        var report = await harness.RunAsync();

        harness.Storage.Removals.Count.ShouldBe(1);
        harness.Time.Delays.ShouldBeEmpty();
        row.Attempts.ShouldBe(1);
        row.LastFailureCode.ShouldBe("refused");
        report.Lines.Single(line => line.Failed).Label.ShouldBe(FailingLabel);
    }

    [Fact]
    public async Task ANotFoundAnswerDeletesTheRowAndCountsAsRemoved()
    {
        var harness = new Harness();
        harness.Queue.Add(PublicId(1));
        harness.Storage.Script(NotFound);

        var report = await harness.RunAsync();

        harness.Queue.Rows.ShouldBeEmpty();
        var line = report.Lines.ShouldHaveSingleItem();
        (line.Label, line.Value, line.Failed).ShouldBe((RemovedLabel, 1L, false));
    }

    [Fact]
    public async Task AnUnauthorizedAnswerStopsTheJobAtOnceAndLeavesEveryRowForTheNextRun()
    {
        var harness = new Harness();
        var rows = new[] { harness.Queue.Add(PublicId(1)), harness.Queue.Add(PublicId(2)), harness.Queue.Add(PublicId(3)) };
        harness.Storage.Script(Unauthorized);

        var report = await harness.RunAsync();

        harness.Storage.Removals.Count.ShouldBe(1);
        harness.Time.Delays.ShouldBeEmpty();
        report.More.ShouldBeFalse();
        var failed = report.Lines.Single(line => line.Failed);
        failed.Text.ShouldBe(KeysRefusedText);
        report.Lines.ShouldNotContain(line => line.Label == FailingLabel);
        rows.ShouldAllBe(row => row.Attempts == 0 && row.LeaseHolder == null && row.LastFailureCode == null);
    }

    [Fact]
    public async Task ASpentBudgetAfterTheFirstRowStopsClaimingReleasesTheOthersAndReportsMore()
    {
        var harness = new Harness();
        for (var number = 1; number <= 5; number++)
        {
            harness.Queue.Add(PublicId(number));
        }

        var budget = new MaintenanceBudget(harness.Time, TimeSpan.FromSeconds(1));
        harness.Storage.OnRemove = _ => harness.Time.Advance(TimeSpan.FromSeconds(2));

        var report = await harness.RunAsync(budget);

        report.More.ShouldBeTrue();
        harness.Storage.Removals.Count.ShouldBe(1);
        harness.Queue.Rows.Count.ShouldBe(4);
        harness.Queue.Rows.ShouldAllBe(row => row.LeaseHolder == null);
        report.Lines.Single(line => line.Label == RemovedLabel).Value.ShouldBe(1);
    }

    [Fact]
    public async Task AFullBatchWithTheBudgetSpentReportsMoreWithoutClaimingAgain()
    {
        var harness = new Harness();
        for (var number = 1; number <= 30; number++)
        {
            harness.Queue.Add(PublicId(number));
        }

        var budget = new MaintenanceBudget(harness.Time, TimeSpan.FromSeconds(1));
        var removals = 0;
        harness.Storage.OnRemove = _ =>
        {
            if (++removals == 25)
            {
                harness.Time.Advance(TimeSpan.FromSeconds(2));
            }
        };

        var report = await harness.RunAsync(budget);

        report.More.ShouldBeTrue();
        harness.Queue.Claims.ShouldBe(1);
        harness.Queue.Rows.Count.ShouldBe(5);
    }

    [Fact]
    public async Task AnErrorFromTheStorageReleasesTheLeasesAndLetsTheErrorOut()
    {
        var harness = new Harness();
        harness.Queue.Add(PublicId(1));
        harness.Queue.Add(PublicId(2));
        harness.Storage.RemoveFailure = new InvalidOperationException("The storage broke.");

        await Should.ThrowAsync<InvalidOperationException>(() => harness.RunAsync());

        harness.Queue.Rows.ShouldAllBe(row => row.LeaseHolder == null && row.Attempts == 0);
    }

    [Fact]
    public async Task AFileOutsideTheEnvironmentsOrdersFolderIsNeverRemovedAndTurnsTheRunRed()
    {
        var harness = new Harness();
        var foreign = harness.Queue.Add("csps/orders/00000000-0000-0000-0000-000000000001/photo001");
        var lookalike = harness.Queue.Add("csps-test-more/orders/00000000-0000-0000-0000-000000000001/photo001");
        harness.Queue.Add(PublicId(1));

        var report = await harness.RunAsync();

        harness.Storage.Removals.ShouldBe([PublicId(1)]);
        foreign.LastFailureCode.ShouldBe("outside-folder");
        lookalike.LastFailureCode.ShouldBe("outside-folder");
        report.Lines.Single(line => line.Failed).Value.ShouldBe(2);
    }

    [Fact]
    public async Task AStorageThatIsNotSetUpTouchesNothingAndDoesNotFailTheRun()
    {
        var harness = new Harness();
        harness.Storage.IsConfigured = false;
        var row = harness.Queue.Add(PublicId(1));

        var report = await harness.RunAsync();

        harness.Queue.Claims.ShouldBe(0);
        harness.Storage.Removals.ShouldBeEmpty();
        row.Attempts.ShouldBe(0);
        report.More.ShouldBeFalse();
        var line = report.Lines.ShouldHaveSingleItem();
        line.Failed.ShouldBeFalse();
        line.Text.ShouldBe("photo storage is not set up.");
    }

    [Fact]
    public async Task NoLineOrLogCallCarriesAPublicId()
    {
        var harness = new Harness();
        harness.Queue.Add(PublicId(1));
        harness.Queue.Add(PublicId(2));
        harness.Storage.Script(Refused, Removed);

        var report = await harness.RunAsync();

        report.Lines.ShouldAllBe(line => !(line.Label + line.Text).Contains("photo00", StringComparison.Ordinal));
        harness.Log.ReceivedCalls().ShouldAllBe(call => call.GetArguments().All(argument => !(argument + string.Empty).Contains("photo00", StringComparison.Ordinal)));
    }

    // A fake clock that notes every wait asked of it, so the test can check the length and then let that much time pass.
    private sealed class RecordingTimeProvider : FakeTimeProvider
    {
        public List<TimeSpan> Delays { get; } = [];

        public ConcurrentQueue<TimeSpan> Waiting { get; } = new();

        public override ITimer CreateTimer(TimerCallback callback, object? state, TimeSpan dueTime, TimeSpan period)
        {
            Delays.Add(dueTime);
            var timer = base.CreateTimer(callback, state, dueTime, period);
            Waiting.Enqueue(dueTime);
            return timer;
        }
    }

    private sealed class Harness
    {
        public Harness()
        {
            Time = new RecordingTimeProvider();
            Time.SetUtcNow(new DateTimeOffset(2026, 11, 3, 12, 0, 0, TimeSpan.Zero));
            Log = Substitute.For<IMaintenanceJobLog>();
            Job = new ImageRemovalJob(Storage, Queue, Time, Log);
        }

        public RecordingTimeProvider Time { get; }

        public FakeImageStorage Storage { get; } = new();

        public FakeImageDeletionQueue Queue { get; } = new();

        public IMaintenanceJobLog Log { get; }

        public ImageRemovalJob Job { get; }

        // Runs the job and lets each retry wait pass as soon as the job asks for it.
        public async Task<MaintenanceJobReport> RunAsync(MaintenanceBudget? budget = null)
        {
            var run = Job.RunAsync(budget ?? new MaintenanceBudget(Time), TestContext.Current.CancellationToken);
            while (!run.IsCompleted)
            {
                if (Time.Waiting.TryDequeue(out var wait))
                {
                    Time.Advance(wait);
                }
                else
                {
                    await Task.Yield();
                }
            }

            return await run;
        }
    }
}
