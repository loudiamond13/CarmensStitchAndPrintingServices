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
/// D-26, IMG-01, JOB-02, T-11-76: a share picture upload checks the session and the storage before it reads the file; once the file is
/// stored, anything that stops the settings row from being saved queues the file as UploadUndone on its own context, and a replace queues
/// the old file in the same save as the new picture. Every picture gets a new id.
/// </summary>
public sealed class UploadSharePictureHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 9, 0, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly byte[] Photo = SyntheticImages.Jpeg(1200, 630);
    private const string OldId = "csps-test/content/share/00000000-0000-0000-0000-000000000001/oldoldoldoldoldoldoldold2";

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static UploadSharePictureRequest Request(byte[]? bytes = null) => new(bytes ?? Photo, "p.jpg");

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
    public async Task AMissingFileIsRefusedBeforeAnythingIsStored()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request(bytes: []), Token);

        result.Error.ShouldBe(ImageErrors.FileMissing);
        harness.StoredIds.ShouldBeEmpty();
        harness.Queue.Calls.ShouldBeEmpty();
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
    public async Task AFirstPictureIsStoredUnderANewIdInTheShareFolderAndNothingIsQueued()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request(), Token);

        result.IsSuccess.ShouldBeTrue();
        (result.Value.Width, result.Value.Height).ShouldBe((1200, 630));
        result.Value.Src320.ShouldBe("https://images.example.test/320");
        result.Value.Src640.ShouldBe("https://images.example.test/640");
        var storedId = harness.StoredIds.ShouldHaveSingleItem();
        storedId.ShouldStartWith("csps-test/content/share/00000000-0000-0000-0000-000000000001/");
        harness.Settings.SharePicturePublicId.ShouldBe(storedId);
        (harness.Settings.SharePictureWidth, harness.Settings.SharePictureHeight, harness.Settings.SharePictureFormat).ShouldBe((1200, 630, "jpg"));
        harness.Queue.Calls.ShouldBeEmpty();
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task AReplaceGivesANewIdAndQueuesTheOldFileInTheSameTransaction()
    {
        var harness = new Harness();
        harness.OldPicture = new LinePhotoFile(OldId, 100, 100, 1000, "jpg");
        var queuedInsideTransaction = false;
        harness.Queue.OnEnqueue = () => queuedInsideTransaction = harness.Unit.InTransaction;

        var result = await harness.Handler.HandleAsync(Request(), Token);

        result.IsSuccess.ShouldBeTrue();
        var storedId = harness.StoredIds.ShouldHaveSingleItem();
        storedId.ShouldNotBe(OldId);
        harness.Settings.SharePicturePublicId.ShouldBe(storedId);
        harness.Queue.Calls.ShouldBe([(OldId, ImageDeletionReason.PhotoReplaced, false)]);
        queuedInsideTransaction.ShouldBeTrue();
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
    public async Task ASaveThatLosesARaceTwiceAnswersBusyAndQueuesTheFile()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(Request(), Token);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
        harness.Queue.Calls.Select(call => call.Reason).ShouldBe([ImageDeletionReason.UploadUndone]);
    }

    [Fact]
    public async Task AQueueWriteThatFailsDoesNotReplaceTheOriginalAnswer()
    {
        var harness = new Harness();
        harness.Queue.FailWith(new InvalidOperationException("The queue could not be written."));
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(Request(), Token);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
        harness.Queue.Calls.Count.ShouldBe(1);
    }

    private sealed class RecordingQueue : IImageDeletionQueue
    {
        public List<(string PublicId, ImageDeletionReason Reason, bool TokenWasCancelled)> Calls { get; } = [];

        public Action? OnEnqueue { get; set; }

        public void FailWith(Exception failure) => _failure = failure;

        private Exception? _failure;

        public void Enqueue(string publicId, ImageDeletionReason reason)
        {
            Calls.Add((publicId, reason, false));
            OnEnqueue?.Invoke();
        }

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
            Store = Substitute.For<ISiteContentStore>();

            // Every attempt loads the row afresh, as the real unit of work does after a lost race: a change of the first attempt is gone.
            Store.GetSettingsForUpdateAsync(Arg.Any<CancellationToken>()).Returns(_ =>
            {
                Settings = SiteSettings.CreateDefault(Now);
                if (OldPicture is not null)
                {
                    Settings.SetSharePicture(OldPicture);
                }

                return Task.FromResult(new SiteSettingsForUpdate(Settings, []));
            });
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
            var delivery = Substitute.For<IImageDelivery>();
            delivery.ForSharePreview(Arg.Any<string>()).Returns(new SharePreviewUrls("https://images.example.test/320", "https://images.example.test/640"));
            Handler = new UploadSharePictureHandler(Store, SiteLock, Unit, Context, Storage, Queue, delivery, new ImageUploadSettings());
        }

        public SiteSettings Settings { get; private set; } = null!;

        public LinePhotoFile? OldPicture { get; set; }

        public ISiteContentStore Store { get; }

        public IImageStorage Storage { get; }

        public IRequestContext Context { get; }

        public ISiteContentLock SiteLock { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingQueue Queue { get; } = new();

        public List<string> StoredIds { get; } = [];

        public UploadSharePictureHandler Handler { get; }
    }
}
