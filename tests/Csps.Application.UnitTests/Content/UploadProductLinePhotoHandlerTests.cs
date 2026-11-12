using Csps.Application.Auth;
using Csps.Application.Content;
using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Content;
using Csps.Testing.Images;
using NSubstitute;

namespace Csps.Application.UnitTests.Content;

/// <summary>
/// D-02, IMG-01, JOB-02, T-11-46: a line photo upload checks the session, the storage and the line before it reads the file; once the
/// file is stored, anything that stops the photo row from being saved queues the file as UploadUndone on its own context, and a replace
/// queues the old file in the same save as the new row.
/// </summary>
public sealed class UploadProductLinePhotoHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 9, 0, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid LineId = ProductLineSeed.All[0].Id;
    private static readonly byte[] Photo = SyntheticImages.Jpeg(640, 480);

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static UploadProductLinePhotoRequest Request(ProductLinePhotoSlot slot = ProductLinePhotoSlot.Main, byte[]? bytes = null) =>
        new(LineId, slot, bytes ?? Photo, "p.jpg");

    [Fact]
    public async Task NoUsableSessionGivesTheSessionErrorAndTouchesNothing()
    {
        var harness = new Harness();
        harness.Context.UserId.Returns((Guid?)null);

        var result = await harness.Handler.HandleAsync(Request(), Token);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.StoredIds.ShouldBeEmpty();
        harness.Queue.Calls.ShouldBeEmpty();
    }

    [Fact]
    public async Task StorageThatIsNotSetUpGivesTheNotConfiguredError()
    {
        var harness = new Harness();
        harness.Storage.IsConfigured.Returns(false);

        var result = await harness.Handler.HandleAsync(Request(), Token);

        result.Error.ShouldBe(ImageErrors.NotConfigured);
        harness.StoredIds.ShouldBeEmpty();
    }

    [Fact]
    public async Task AMissingFileAndAMissingLineAreRefusedBeforeAnythingIsStored()
    {
        var harness = new Harness();

        var empty = await harness.Handler.HandleAsync(Request(bytes: []), Token);
        harness.Lines.GetTitlesAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns(new Dictionary<Guid, string>());
        var noLine = await harness.Handler.HandleAsync(Request(), Token);

        empty.Error.ShouldBe(ImageErrors.FileMissing);
        noLine.Error.ShouldBe(SiteContentErrors.LineNotFound);
        harness.StoredIds.ShouldBeEmpty();
        harness.Queue.Calls.ShouldBeEmpty();
    }

    [Fact]
    public async Task ASaveThatThrowsAfterTheFileWasStoredQueuesTheNewFileAsUploadUndoneAndLetsTheErrorThrough()
    {
        var harness = new Harness();
        harness.Unit.ThrowOnSave(new InvalidOperationException("The database went away."));

        var error = await Should.ThrowAsync<InvalidOperationException>(() => harness.Handler.HandleAsync(Request(), Token));

        error.Message.ShouldBe("The database went away.");
        harness.Queue.Calls.Select(call => call.Reason).ShouldBe([ImageDeletionReason.UploadUndone]);
        harness.Queue.Calls[0].PublicId.ShouldBe(harness.StoredIds.ShouldHaveSingleItem());
        harness.Queue.Calls[0].TokenWasCancelled.ShouldBeFalse();
    }

    [Fact]
    public async Task ALineDeletedWhileTheFileWasUploadingIsA404AndTheFileIsQueuedAsUploadUndone()
    {
        var harness = new Harness();
        harness.Lines.FindAsync(LineId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<ProductLine?>(null));

        var result = await harness.Handler.HandleAsync(Request(), Token);

        result.Error.ShouldBe(SiteContentErrors.LineNotFound);
        harness.Queue.Calls.Select(call => call.Reason).ShouldBe([ImageDeletionReason.UploadUndone]);
        harness.Queue.Calls[0].PublicId.ShouldBe(harness.StoredIds.ShouldHaveSingleItem());
    }

    [Fact]
    public async Task AnEmptySlotAddsANewRowUnderTheContentFolderAndQueuesNothing()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request(ProductLinePhotoSlot.Back), Token);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Slot.ShouldBe("back");
        var added = harness.Added.ShouldHaveSingleItem();
        added.Slot.ShouldBe(ProductLinePhotoSlot.Back);
        added.PublicId.ShouldStartWith($"csps-test/content/lines/{LineId:D}/");
        added.PublicId.ShouldBe(harness.StoredIds.ShouldHaveSingleItem());
        harness.Queue.Calls.ShouldBeEmpty();
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task AReplaceKeepsTheRowPutsTheNewFileInItAndQueuesTheOldFileInTheSameTransaction()
    {
        var harness = new Harness();
        var existing = ProductLinePhoto.Create(LineId, ProductLinePhotoSlot.Main, $"csps-test/content/lines/{LineId:D}/oldoldoldoldoldoldoldold2", 100, 100, 1000, "jpg", Now);
        harness.Lines.FindPhotoAsync(LineId, ProductLinePhotoSlot.Main, Arg.Any<CancellationToken>()).Returns(Task.FromResult<ProductLinePhoto?>(existing));
        var queuedInsideTransaction = false;
        harness.Queue.OnEnqueue = () => queuedInsideTransaction = harness.Unit.InTransaction;

        var result = await harness.Handler.HandleAsync(Request(), Token);

        result.IsSuccess.ShouldBeTrue();
        harness.Added.ShouldBeEmpty();
        existing.PublicId.ShouldBe(harness.StoredIds.ShouldHaveSingleItem());
        (existing.Width, existing.Height).ShouldBe((640, 480));
        harness.Queue.Calls.ShouldBe([($"csps-test/content/lines/{LineId:D}/oldoldoldoldoldoldoldold2", ImageDeletionReason.PhotoReplaced, false)]);
        queuedInsideTransaction.ShouldBeTrue();
    }

    private sealed class RecordingQueue : IImageDeletionQueue
    {
        public List<(string PublicId, ImageDeletionReason Reason, bool TokenWasCancelled)> Calls { get; } = [];

        public Action? OnEnqueue { get; set; }

        public void Enqueue(string publicId, ImageDeletionReason reason)
        {
            Calls.Add((publicId, reason, false));
            OnEnqueue?.Invoke();
        }

        public Task EnqueueNowAsync(string publicId, ImageDeletionReason reason, CancellationToken cancellationToken)
        {
            Calls.Add((publicId, reason, cancellationToken.IsCancellationRequested));
            return Task.CompletedTask;
        }

        public Task EnqueueManyNowAsync(IReadOnlyCollection<string> publicIds, ImageDeletionReason reason, CancellationToken cancellationToken) =>
            throw new NotSupportedException("An upload never queues in bulk.");

        public Task<IReadOnlyList<QueuedRemoval>> ClaimDueAsync(Guid holder, DateTimeOffset now, TimeSpan lease, int max, CancellationToken cancellationToken) =>
            throw new NotSupportedException("Only the removal job claims rows.");

        public Task CompleteAsync(long id, Guid holder, CancellationToken cancellationToken) =>
            throw new NotSupportedException("Only the removal job completes rows.");

        public Task FailAsync(long id, Guid holder, string failureCode, DateTimeOffset now, CancellationToken cancellationToken) =>
            throw new NotSupportedException("Only the removal job fails rows.");

        public Task ReleaseAsync(IReadOnlyCollection<long> ids, Guid holder, CancellationToken cancellationToken) =>
            throw new NotSupportedException("Only the removal job releases rows.");
    }

    private sealed class Harness
    {
        public Harness()
        {
            var line = ProductLine.FromSeed(ProductLineSeed.All[0], null, null, Now);
            Lines = Substitute.For<IProductLines>();
            Lines.GetTitlesAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns(new Dictionary<Guid, string> { [LineId] = line.Title });
            Lines.FindAsync(LineId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<ProductLine?>(line));
            Lines.FindPhotoAsync(Arg.Any<Guid>(), Arg.Any<ProductLinePhotoSlot>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<ProductLinePhoto?>(null));
            Lines.When(store => store.AddPhoto(Arg.Any<ProductLinePhoto>())).Do(call => Added.Add(call.Arg<ProductLinePhoto>()));
            Storage = Substitute.For<IImageStorage>();
            Storage.IsConfigured.Returns(true);
            Storage.RootFolder.Returns("csps-test");
            Storage.UploadAsync(Arg.Any<ImageUpload>(), Arg.Any<CancellationToken>()).Returns(call =>
            {
                StoredIds.Add(call.Arg<ImageUpload>().PublicId);
                return Task.FromResult(ImageUploadOutcome.Stored);
            });
            Context = Substitute.For<IRequestContext>();
            Context.UserId.Returns(CallerId);
            var siteLock = Substitute.For<ISiteContentLock>();
            siteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
            var time = Substitute.For<TimeProvider>();
            time.GetUtcNow().Returns(Now);
            var delivery = Substitute.For<IImageDelivery>();
            var source = new ImageSource("https://images.example.test/a", "https://images.example.test/a 640w");
            delivery.ForLinePhoto(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<int>()).Returns(new LinePhotoUrls(source, source, source, "https://images.example.test/t"));
            Handler = new UploadProductLinePhotoHandler(Lines, siteLock, Unit, time, Context, Storage, Queue, delivery, new ImageUploadSettings());
        }

        public IProductLines Lines { get; }

        public IImageStorage Storage { get; }

        public IRequestContext Context { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingQueue Queue { get; } = new();

        public List<string> StoredIds { get; } = [];

        public List<ProductLinePhoto> Added { get; } = [];

        public UploadProductLinePhotoHandler Handler { get; }
    }
}
