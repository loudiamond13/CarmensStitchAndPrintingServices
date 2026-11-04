using Csps.Application.Maintenance;
using Csps.Application.Ports;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Application.UnitTests.Maintenance;

/// <summary>
/// JOB-02, D-23, D-07: the stray sweep queues files in this environment's own orders folder that no photo row or removal row knows
/// and that are older than 2 days. It never touches another folder, a known file or a young file.
/// </summary>
public sealed class StraySweepJobTests
{
    private const string StrayLabel = "Stray files removed (older than 2 days)";
    private const string Folder = "csps-test/orders/";
    private static readonly DateTimeOffset Now = new(2026, 11, 3, 12, 0, 0, TimeSpan.Zero);

    private static string PublicId(string name) => $"{Folder}00000000-0000-0000-0000-000000000001/{name}";

    private static StoredImageEntry Entry(string publicId, TimeSpan age) => new(publicId, Now - age);

    [Fact]
    public void TheJobRunsSecondInThePassAsOrder20()
    {
        var harness = new Harness();

        harness.Job.Order.ShouldBe(20);
        harness.Job.Name.ShouldBe("stray-sweep");
    }

    [Fact]
    public async Task OnlyTheOldUnknownFileInTheOwnFolderIsQueuedAsStray()
    {
        var harness = new Harness();
        harness.Inventory.Photos.Add(PublicId("known"));
        harness.Inventory.Queued.Add(PublicId("queued"));
        harness.Storage.Page(null, new StoredImagePage(
            [
                Entry(PublicId("known"), TimeSpan.FromDays(30)),
                Entry(PublicId("queued"), TimeSpan.FromDays(30)),
                Entry(PublicId("stray"), TimeSpan.FromDays(3)),
                Entry(PublicId("young"), TimeSpan.FromDays(1)),
                Entry("csps/orders/00000000-0000-0000-0000-000000000001/other-root", TimeSpan.FromDays(30)),
            ],
            null));

        var report = await harness.RunAsync();

        harness.Queue.Queued.ShouldBe([(PublicId("stray"), ImageDeletionReason.Stray)]);
        var line = report.Lines.ShouldHaveSingleItem();
        (line.Label, line.Value, line.Failed).ShouldBe((StrayLabel, 1L, false));
        report.More.ShouldBeFalse();
    }

    [Fact]
    public async Task OnlyFilesOfTheOwnFolderPrefixWithTheTrailingSlashAreEverChecked()
    {
        var harness = new Harness();
        harness.Storage.Page(null, new StoredImagePage(
            [
                Entry("csps-test-more/orders/x/old", TimeSpan.FromDays(30)),
                Entry("csps-test/orders", TimeSpan.FromDays(30)),
                Entry("csps-test/other/x/old", TimeSpan.FromDays(30)),
                Entry(PublicId("old"), TimeSpan.FromDays(30)),
            ],
            null));

        await harness.RunAsync();

        harness.Storage.Listings.ShouldBe([(Folder, null)]);
        harness.Inventory.Asked.ShouldHaveSingleItem().ShouldBe([PublicId("old")]);
        harness.Queue.Queued.ShouldBe([(PublicId("old"), ImageDeletionReason.Stray)]);
    }

    [Fact]
    public async Task APageIsFollowedThroughItsCursorUntilTheLastPage()
    {
        var harness = new Harness();
        harness.Storage.Page(null, new StoredImagePage([Entry(PublicId("a"), TimeSpan.FromDays(5))], "next-1"));
        harness.Storage.Page("next-1", new StoredImagePage([Entry(PublicId("b"), TimeSpan.FromDays(5))], "next-2"));
        harness.Storage.Page("next-2", new StoredImagePage([Entry(PublicId("c"), TimeSpan.FromDays(5))], null));

        var report = await harness.RunAsync();

        harness.Storage.Listings.ShouldBe([(Folder, null), (Folder, "next-1"), (Folder, "next-2")]);
        harness.Queue.Queued.Select(queued => queued.PublicId).ShouldBe([PublicId("a"), PublicId("b"), PublicId("c")]);
        report.Lines.ShouldHaveSingleItem().Value.ShouldBe(3);
    }

    [Fact]
    public async Task AFileCreatedTwoDaysMinusOneSecondAgoIsKeptAndOneTwoDaysPlusOneSecondAgoIsQueued()
    {
        var harness = new Harness();
        harness.Storage.Page(null, new StoredImagePage(
            [
                Entry(PublicId("almost"), TimeSpan.FromDays(2) - TimeSpan.FromSeconds(1)),
                Entry(PublicId("just-over"), TimeSpan.FromDays(2) + TimeSpan.FromSeconds(1)),
            ],
            null));

        await harness.RunAsync();

        harness.Queue.Queued.ShouldBe([(PublicId("just-over"), ImageDeletionReason.Stray)]);
    }

    [Fact]
    public async Task AFileExactlyTwoDaysOldIsQueued()
    {
        var harness = new Harness();
        harness.Storage.Page(null, new StoredImagePage([Entry(PublicId("exact"), TimeSpan.FromDays(2))], null));

        await harness.RunAsync();

        harness.Queue.Queued.ShouldBe([(PublicId("exact"), ImageDeletionReason.Stray)]);
    }

    [Fact]
    public async Task AFileListedTwiceOnOnePageIsQueuedOnce()
    {
        var harness = new Harness();
        harness.Storage.Page(null, new StoredImagePage([Entry(PublicId("twice"), TimeSpan.FromDays(5)), Entry(PublicId("twice"), TimeSpan.FromDays(5))], null));

        var report = await harness.RunAsync();

        harness.Queue.Queued.Count.ShouldBe(1);
        report.Lines.ShouldHaveSingleItem().Value.ShouldBe(1);
    }

    [Fact]
    public async Task WhenEveryFileIsKnownOrYoungNothingIsQueuedAndTheLineSaysZero()
    {
        var harness = new Harness();
        harness.Inventory.Photos.Add(PublicId("known"));
        harness.Storage.Page(null, new StoredImagePage([Entry(PublicId("known"), TimeSpan.FromDays(9)), Entry(PublicId("young"), TimeSpan.FromHours(1))], null));

        var report = await harness.RunAsync();

        harness.Queue.Queued.ShouldBeEmpty();
        var line = report.Lines.ShouldHaveSingleItem();
        (line.Value, line.Failed).ShouldBe((0L, false));
    }

    [Fact]
    public async Task AStorageThatIsNotSetUpDoesNoWorkAndDoesNotFailTheRun()
    {
        var harness = new Harness();
        harness.Storage.IsConfigured = false;

        var report = await harness.RunAsync();

        harness.Storage.Listings.ShouldBeEmpty();
        harness.Queue.Queued.ShouldBeEmpty();
        report.More.ShouldBeFalse();
        var line = report.Lines.ShouldHaveSingleItem();
        line.Failed.ShouldBeFalse();
        line.Text.ShouldBe("photo storage is not set up.");
    }

    [Fact]
    public async Task ASpentBudgetBetweenPagesStopsListingAndReportsMore()
    {
        var harness = new Harness();
        harness.Storage.Page(null, new StoredImagePage([Entry(PublicId("a"), TimeSpan.FromDays(5))], "next-1"));
        harness.Storage.Page("next-1", new StoredImagePage([Entry(PublicId("b"), TimeSpan.FromDays(5))], null));
        harness.Storage.OnList = () => harness.Time.Advance(TimeSpan.FromSeconds(2));

        var report = await harness.RunAsync(new MaintenanceBudget(harness.Time, TimeSpan.FromSeconds(1)));

        report.More.ShouldBeTrue();
        harness.Storage.Listings.Count.ShouldBe(1);
        harness.Queue.Queued.Select(queued => queued.PublicId).ShouldBe([PublicId("a")]);
        report.Lines.Single(line => line.Label == StrayLabel).Value.ShouldBe(1);
    }

    [Fact]
    public async Task AListingThatCannotBeReadGivesAFailedLineAndKeepsWhatWasAlreadyQueued()
    {
        var harness = new Harness();
        harness.Storage.Page(null, new StoredImagePage([Entry(PublicId("a"), TimeSpan.FromDays(5))], "next-1"));
        harness.Storage.OnList = () => harness.Storage.ListFailure = new ImageStorageException("transient");

        var report = await harness.RunAsync();

        harness.Queue.Queued.Select(queued => queued.PublicId).ShouldBe([PublicId("a")]);
        report.Lines.Single(line => line.Label == StrayLabel).Value.ShouldBe(1);
        var failed = report.Lines.Single(line => line.Failed);
        failed.Label.ShouldBe("Photo storage");
        failed.Text.ShouldBe("The stray file sweep could not read the photo storage.");
        report.More.ShouldBeFalse();
    }

    [Fact]
    public async Task AListingThatFailsAtOnceStillAnswersWithAFailedLineAndNeverThrows()
    {
        var harness = new Harness();
        harness.Storage.ListFailure = new ImageStorageException("unauthorized");

        var report = await harness.RunAsync();

        harness.Queue.Queued.ShouldBeEmpty();
        report.Lines.Single(line => line.Failed).Text.ShouldBe("The stray file sweep could not read the photo storage.");
    }

    [Fact]
    public async Task NoLineCarriesAPublicId()
    {
        var harness = new Harness();
        harness.Storage.Page(null, new StoredImagePage([Entry(PublicId("secret-name"), TimeSpan.FromDays(5))], null));

        var report = await harness.RunAsync();

        report.Lines.ShouldAllBe(line => !(line.Label + line.Text).Contains("secret-name", StringComparison.Ordinal));
    }

    private sealed class Harness
    {
        public Harness()
        {
            Time = new FakeTimeProvider(Now);
            Job = new StraySweepJob(Storage, Queue, Inventory, Time);
        }

        public FakeTimeProvider Time { get; }

        public FakeImageStorage Storage { get; } = new();

        public FakeImageDeletionQueue Queue { get; } = new();

        public FakeImageInventory Inventory { get; } = new();

        public StraySweepJob Job { get; }

        public Task<MaintenanceJobReport> RunAsync(MaintenanceBudget? budget = null) =>
            Job.RunAsync(budget ?? new MaintenanceBudget(Time), TestContext.Current.CancellationToken);
    }
}
