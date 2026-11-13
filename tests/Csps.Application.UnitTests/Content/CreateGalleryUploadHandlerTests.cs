using Csps.Application.Auth;
using Csps.Application.Content;
using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Content;
using Csps.Testing.Images;
using NSubstitute;

namespace Csps.Application.UnitTests.Content;

/// <summary>
/// GAL-03, IMG-01, JOB-02, T-11-70: a gallery upload checks the session, the storage, the form and the line before it reads the file;
/// once the file is stored, anything that stops the entry from being saved queues the file as UploadUndone on its own context, and the
/// entry joins at the top of the gallery with an audit entry that never holds the address.
/// </summary>
public sealed class CreateGalleryUploadHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 9, 0, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid LineId = ProductLineSeed.All[0].Id;
    private static readonly byte[] Photo = SyntheticImages.Jpeg(640, 480);

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static CreateGalleryUploadRequest Request(byte[]? bytes = null, GalleryUploadRequest? form = null) =>
        new(form ?? new GalleryUploadRequest("Tondo Sample Riders", LineId, 12m, "Dri-fit mesh", true, null), bytes ?? Photo, "p.jpg");

    [Fact]
    public async Task NoUsableSessionGivesTheSessionErrorAndTouchesNothing()
    {
        var harness = new Harness();
        harness.Context.UserId.Returns((Guid?)null);

        var result = await harness.Handler.HandleAsync(Request(), Token);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.StoredIds.ShouldBeEmpty();
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
    public async Task AMissingPhotoTeamAndLineAreRefusedWithTheirMessagesBeforeAnythingIsStored()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request(bytes: [], form: GalleryUploadRequest.Empty), Token);

        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["file", "teamName", "productLineId"], ignoreOrder: true);
        result.Error.FieldErrors["file"].ShouldBe(["Choose a photo."]);
        harness.StoredIds.ShouldBeEmpty();
        harness.Queue.Calls.ShouldBeEmpty();
    }

    [Fact]
    public async Task ALineThatDoesNotExistIsRefusedUnderTheLineFieldBeforeAnythingIsStored()
    {
        var harness = new Harness();
        harness.Lines.GetTitlesAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns(new Dictionary<Guid, string>());

        var result = await harness.Handler.HandleAsync(Request(), Token);

        result.Error.ShouldBe(SiteContentErrors.GalleryLineUnknown);
        harness.StoredIds.ShouldBeEmpty();
    }

    [Fact]
    public async Task AFileThatIsNotAPhotoIsRefusedBeforeItReachesTheStorage()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request(bytes: SyntheticImages.Svg()), Token);

        result.Error.Code.ShouldBe(ImageErrors.TypeCode);
        harness.StoredIds.ShouldBeEmpty();
    }

    [Fact]
    public async Task AValidUploadJoinsAtTheTopHiddenUnlessShownAndIsAuditedWithoutTheAddress()
    {
        var harness = new Harness();
        harness.Entries.GetTopPositionAsync(Arg.Any<CancellationToken>()).Returns(-4);

        var result = await harness.Handler.HandleAsync(Request(), Token);

        result.IsSuccess.ShouldBeTrue();
        var entry = harness.Added.ShouldHaveSingleItem();
        (entry.Kind, entry.Position, entry.IsShown, entry.TeamName, entry.ProductLineId, entry.Pieces, entry.Note).ShouldBe(
            (GalleryEntryKind.Upload, -4, true, "Tondo Sample Riders", LineId, 12, "Dri-fit mesh"));
        entry.PublicId.ShouldBe(harness.StoredIds.ShouldHaveSingleItem());
        entry.PublicId.ShouldStartWith($"csps-test/content/gallery/{entry.Id:D}/");
        (entry.Width, entry.Height, entry.Format).ShouldBe((640, 480, "jpg"));
        harness.Unit.Commits.ShouldBe(1);
        harness.Queue.Calls.ShouldBeEmpty();
        var audit = harness.Audit.Entries.ShouldHaveSingleItem();
        (audit.Action, audit.TargetType, audit.TargetId).ShouldBe((AuditActions.GalleryPhotoAdded, "GalleryEntry", entry.Id.ToString("D")));
        audit.Detail.ShouldBe("team=Tondo Sample Riders;line=Basketball Jerseys");
        audit.Detail!.ShouldNotContain(entry.PublicId);
        result.Value.Id.ShouldBe(entry.Id);
        result.Value.Thumb.ShouldBe("https://images.example.test/t");
    }

    [Fact]
    public async Task AnUploadWithNoShownFlagIsHidden()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request(form: new GalleryUploadRequest("Tondo Sample Riders", LineId, null, null, null, null)), Token);

        result.IsSuccess.ShouldBeTrue();
        harness.Added.ShouldHaveSingleItem().IsShown.ShouldBeFalse();
    }

    [Fact]
    public async Task ALineDeletedWhileTheFileWasUploadingIsRefusedAndTheFileIsQueuedAsUploadUndone()
    {
        var harness = new Harness();
        harness.Lines.GetTitlesAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, string> { [LineId] = "Basketball Jerseys" }, new Dictionary<Guid, string>());

        var result = await harness.Handler.HandleAsync(Request(), Token);

        result.Error.ShouldBe(SiteContentErrors.GalleryLineUnknown);
        harness.Queue.Calls.Select(call => call.Reason).ShouldBe([ImageDeletionReason.UploadUndone]);
        harness.Queue.Calls[0].PublicId.ShouldBe(harness.StoredIds.ShouldHaveSingleItem());
        harness.Added.ShouldBeEmpty();
    }

    [Fact]
    public async Task ASaveThatThrowsAfterTheFileWasStoredQueuesTheFileAndLetsTheErrorThrough()
    {
        var harness = new Harness();
        harness.Unit.ThrowOnSave(new InvalidOperationException("The database went away."));

        var error = await Should.ThrowAsync<InvalidOperationException>(() => harness.Handler.HandleAsync(Request(), Token));

        error.Message.ShouldBe("The database went away.");
        harness.Queue.Calls.Select(call => call.Reason).ShouldBe([ImageDeletionReason.UploadUndone]);
        harness.Queue.Calls[0].PublicId.ShouldBe(harness.StoredIds.ShouldHaveSingleItem());
        harness.Queue.Calls[0].TokenWasCancelled.ShouldBeFalse();
    }

    [Theory]
    [InlineData(ImageFailureCodes.Transient, 1)]
    [InlineData("refused", 0)]
    public async Task AFileTheStorageDidNotTakeIsAStorageFailureAndOnlyALostReplyQueuesIt(string code, int queued)
    {
        var harness = new Harness();
        harness.Storage.UploadAsync(Arg.Any<ImageUpload>(), Arg.Any<CancellationToken>()).Returns(ImageUploadOutcome.Failed(code));

        var result = await harness.Handler.HandleAsync(Request(), Token);

        result.Error.ShouldBe(ImageErrors.StorageFailed);
        harness.Queue.Calls.Count.ShouldBe(queued);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AnUploadThatCannotGetTheSiteContentLockAnswersBusyAndQueuesTheFile()
    {
        var harness = new Harness();
        harness.SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(Task.FromException(new SiteContentBusyException()));

        var result = await harness.Handler.HandleAsync(Request(), Token);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
        harness.Queue.Calls.Select(call => call.Reason).ShouldBe([ImageDeletionReason.UploadUndone]);
    }

    [Fact]
    public async Task ASaveThatLosesARaceTwiceAnswersBusyAndAFailingQueueWriteDoesNotReplaceTheAnswer()
    {
        var harness = new Harness();
        harness.Queue.FailWith(new InvalidOperationException("The queue could not be written."));
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(Request(), Token);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
        harness.Queue.Calls.Count.ShouldBe(1);
    }

    [Fact]
    public async Task AnEntryThatCannotBeReadBackIsANotFound()
    {
        var harness = new Harness();
        harness.Entries.GetItemAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<GalleryItemRow?>(null));

        var result = await harness.Handler.HandleAsync(Request(), Token);

        result.Error.ShouldBe(SiteContentErrors.GalleryItemNotFound);
    }

    private sealed class RecordingQueue : IImageDeletionQueue
    {
        public List<(string PublicId, ImageDeletionReason Reason, bool TokenWasCancelled)> Calls { get; } = [];

        private Exception? _failure;

        public void FailWith(Exception failure) => _failure = failure;

        public void Enqueue(string publicId, ImageDeletionReason reason) => Calls.Add((publicId, reason, false));

        public Task EnqueueNowAsync(string publicId, ImageDeletionReason reason, CancellationToken cancellationToken)
        {
            Calls.Add((publicId, reason, cancellationToken.IsCancellationRequested));
            return _failure is null ? Task.CompletedTask : Task.FromException(_failure);
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
            Lines = Substitute.For<IProductLines>();
            Lines.GetTitlesAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns(new Dictionary<Guid, string> { [LineId] = "Basketball Jerseys" });
            Entries = Substitute.For<IGalleryEntries>();
            Entries.GetTopPositionAsync(Arg.Any<CancellationToken>()).Returns(0);
            Entries.When(store => store.Add(Arg.Any<GalleryEntry>())).Do(call => Added.Add(call.Arg<GalleryEntry>()));
            Entries.GetItemAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(call => Task.FromResult<GalleryItemRow?>(
                new GalleryItemRow(call.Arg<Guid>(), GalleryEntryKind.Upload, 0, "Tondo Sample Riders", LineId, "Basketball", false, 12, true, null, null, "Dri-fit mesh", "csps-test/x", 640, 480, [1, 2, 3, 4, 5, 6, 7, 8])));
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
            SiteLock = Substitute.For<ISiteContentLock>();
            SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
            var time = Substitute.For<TimeProvider>();
            time.GetUtcNow().Returns(Now);
            var delivery = Substitute.For<IImageDelivery>();
            var source = new ImageSource("https://images.example.test/a", "https://images.example.test/a 640w");
            delivery.ForGallery(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<int>()).Returns(new GalleryPhotoUrls(source, source, "https://images.example.test/t"));
            Handler = new CreateGalleryUploadHandler(Entries, Lines, SiteLock, Audit, Unit, time, Context, Storage, Queue, delivery, new ImageUploadSettings(), new GalleryUploadRequestValidator());
        }

        public IGalleryEntries Entries { get; }

        public IProductLines Lines { get; }

        public IImageStorage Storage { get; }

        public IRequestContext Context { get; }

        public ISiteContentLock SiteLock { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public RecordingQueue Queue { get; } = new();

        public List<string> StoredIds { get; } = [];

        public List<GalleryEntry> Added { get; } = [];

        public CreateGalleryUploadHandler Handler { get; }
    }
}
