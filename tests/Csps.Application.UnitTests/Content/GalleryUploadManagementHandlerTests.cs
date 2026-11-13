using Csps.Application.Auth;
using Csps.Application.Common;
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
/// GAL-03, SEC-07, AUDIT-01: a Manager edits, replaces the photo of, hides, shows and deletes a gallery upload. An order item is no
/// upload and is a 404; a stale version is a 409; each change writes its audit entry in the same save and never the note or the address.
/// </summary>
public sealed class GalleryUploadManagementHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 9, 0, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid Moto = ProductLineSeed.All.Single(entry => entry.Key == "moto").Id;
    private static readonly Guid Basketball = ProductLineSeed.All.Single(entry => entry.Key == "basketball").Id;
    private static readonly byte[] Version = [1, 2, 3, 4, 5, 6, 7, 8];
    private static readonly string VersionText = RowVersions.ToText(Version);
    private static readonly byte[] Photo = SyntheticImages.Jpeg(640, 480);

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static GalleryEntry NewUpload()
    {
        var entry = GalleryEntry.CreateUpload(
            GalleryEntry.NewId(Now),
            new GalleryUploadValues("Tondo Sample Riders", Moto, 12m, "Dri-fit mesh", true),
            new LinePhotoFile("csps-test/content/gallery/abc/old", 800, 600, 1000, "jpg"),
            0,
            Now).Value;
        typeof(GalleryEntry).GetProperty(nameof(GalleryEntry.RowVersion))!.SetValue(entry, Version);
        return entry;
    }

    private static GalleryUploadRequest Form(Guid? line = null, string team = "Tondo Sample Riders", string? note = "Dri-fit mesh", bool? shown = null, string? version = null) =>
        new(team, line ?? Moto, 12m, note, shown, version ?? VersionText);

    private static GalleryItemRow Row(Guid id, GalleryEntryKind kind = GalleryEntryKind.Upload) =>
        new(id, kind, 0, "Tondo Sample Riders", Moto, "Moto", false, 12, true, null, null, null, "csps-test/x", 800, 600, Version);

    private sealed class RecordingQueue : IImageDeletionQueue
    {
        public List<(string PublicId, ImageDeletionReason Reason)> Calls { get; } = [];

        private Exception? _failure;

        public void FailWith(Exception failure) => _failure = failure;

        public void Enqueue(string publicId, ImageDeletionReason reason) => Calls.Add((publicId, reason));

        public Task EnqueueNowAsync(string publicId, ImageDeletionReason reason, CancellationToken cancellationToken)
        {
            Calls.Add((publicId, reason));
            return _failure is null ? Task.CompletedTask : Task.FromException(_failure);
        }

        public Task EnqueueManyNowAsync(IReadOnlyCollection<string> publicIds, ImageDeletionReason reason, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<QueuedRemoval>> ClaimDueAsync(Guid holder, DateTimeOffset now, TimeSpan lease, int max, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task CompleteAsync(long id, Guid holder, CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task FailAsync(long id, Guid holder, string failureCode, DateTimeOffset now, CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task ReleaseAsync(IReadOnlyCollection<long> ids, Guid holder, CancellationToken cancellationToken) => throw new NotSupportedException();
    }

    private sealed class Harness
    {
        public Harness()
        {
            Entry = NewUpload();
            Entries = Substitute.For<IGalleryEntries>();
            Entries.FindUploadAsync(Entry.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<GalleryEntry?>(Entry));
            Entries.GetItemAsync(Entry.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<GalleryItemRow?>(Row(Entry.Id)));
            Lines = Substitute.For<IProductLines>();
            Lines.GetTitlesAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
                .Returns(new Dictionary<Guid, string> { [Moto] = "Moto Riding Jerseys", [Basketball] = "Basketball Jerseys" });
            SiteLock = Substitute.For<ISiteContentLock>();
            SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
            Delivery = Substitute.For<IImageDelivery>();
            var source = new ImageSource("a", "a 1w");
            Delivery.ForGallery(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<int>()).Returns(new GalleryPhotoUrls(source, source, "https://images.example.test/t"));
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
        }

        public GalleryEntry Entry { get; }

        public IGalleryEntries Entries { get; }

        public IProductLines Lines { get; }

        public ISiteContentLock SiteLock { get; }

        public IImageDelivery Delivery { get; }

        public IImageStorage Storage { get; }

        public IRequestContext Context { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public RecordingQueue Queue { get; } = new();

        public List<string> StoredIds { get; } = [];

        public UpdateGalleryUploadHandler Update() => new(Entries, Lines, SiteLock, Audit, Unit, new GalleryUploadRequestValidator(), Delivery);

        public SetGalleryUploadShownHandler SetShown() => new(Entries, Lines, Audit, Unit);

        public DeleteGalleryUploadHandler Delete() => new(Entries, Lines, Audit, Unit, Queue);

        public ReplaceGalleryPhotoHandler Replace() => new(Entries, Audit, Unit, Context, Storage, Queue, Delivery, new ImageUploadSettings());
    }

    // Update

    [Fact]
    public async Task AnEditWithoutAVersionIsRefusedBeforeTheStoreIsRead()
    {
        var harness = new Harness();

        var result = await harness.Update().HandleAsync(harness.Entry.Id, Form(version: "not a version"), Token);

        result.Error.Code.ShouldBe(SiteContentErrors.InvalidCode);
        await harness.Entries.DidNotReceiveWithAnyArgs().FindUploadAsync(default, Token);
    }

    [Fact]
    public async Task AnEditOfAnUploadThatIsGoneOrAnOrderItemIsA404()
    {
        var harness = new Harness();

        var result = await harness.Update().HandleAsync(Guid.NewGuid(), Form(), Token);

        result.Error.ShouldBe(SiteContentErrors.GalleryItemNotFound);
    }

    [Fact]
    public async Task AStaleVersionIsA409AndNothingIsChanged()
    {
        var harness = new Harness();

        var result = await harness.Update().HandleAsync(harness.Entry.Id, Form(team: "Changed", version: RowVersions.ToText([8, 7, 6, 5, 4, 3, 2, 1])), Token);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Entry.TeamName.ShouldBe("Tondo Sample Riders");
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ALineThatDoesNotExistIsRefusedUnderTheLineFieldAndNothingIsChanged()
    {
        var harness = new Harness();

        var result = await harness.Update().HandleAsync(harness.Entry.Id, Form(line: Guid.NewGuid(), team: "Changed"), Token);

        result.Error.ShouldBe(SiteContentErrors.GalleryLineUnknown);
        harness.Entry.TeamName.ShouldBe("Tondo Sample Riders");
    }

    [Fact]
    public async Task AFormWithNoChangeSavesNothingAndWritesNoAuditEntry()
    {
        var harness = new Harness();

        var result = await harness.Update().HandleAsync(harness.Entry.Id, Form(), Token);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
        result.Value.Version.ShouldBe(RowVersions.ToText(Version));
    }

    [Fact]
    public async Task AChangeWritesOneChangedEntryNamingTheFieldsAndNeverTheNote()
    {
        var harness = new Harness();

        var result = await harness.Update().HandleAsync(harness.Entry.Id, Form(line: Basketball, team: "Tondo Sample Riders MC", note: "A private sample sentence"), Token);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(1);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        (entry.Action, entry.TargetType, entry.TargetId).ShouldBe((AuditActions.GalleryPhotoChanged, "GalleryEntry", harness.Entry.Id.ToString("D")));
        entry.Detail.ShouldBe("fields=team,line,note;team=Tondo Sample Riders>Tondo Sample Riders MC;line=Moto Riding Jerseys>Basketball Jerseys");
        entry.Detail!.ShouldNotContain("private");
    }

    [Fact]
    public async Task AFlipOfTheShownFlagAloneWritesOnlyTheHiddenEntryAndAChangeAndAFlipWriteBoth()
    {
        var hide = new Harness();
        var both = new Harness();

        var hidden = await hide.Update().HandleAsync(hide.Entry.Id, Form(shown: false), Token);
        var bothResult = await both.Update().HandleAsync(both.Entry.Id, Form(team: "Renamed", shown: false), Token);

        hidden.IsSuccess.ShouldBeTrue();
        bothResult.IsSuccess.ShouldBeTrue();
        var only = hide.Audit.Entries.ShouldHaveSingleItem();
        (only.Action, only.Detail).ShouldBe((AuditActions.GalleryPhotoHidden, "team=Tondo Sample Riders;line=Moto Riding Jerseys"));
        both.Audit.Entries.Select(entry => entry.Action).ShouldBe([AuditActions.GalleryPhotoChanged, AuditActions.GalleryPhotoHidden]);
    }

    [Fact]
    public async Task AShownFlipOnAHiddenUploadWritesTheShownEntry()
    {
        var harness = new Harness();
        harness.Entry.Hide().ShouldBeTrue();

        var result = await harness.Update().HandleAsync(harness.Entry.Id, Form(shown: true), Token);

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.ShouldHaveSingleItem().Action.ShouldBe(AuditActions.GalleryPhotoShown);
    }

    [Fact]
    public async Task ASaveThatLosesARaceIsA409StaleAndABusyLockIsBusy()
    {
        var conflict = new Harness();
        conflict.Unit.ThrowOnSave(new ConcurrencyConflictException(new InvalidOperationException("Another request changed the row.")));
        var busy = new Harness();
        busy.SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(Task.FromException(new SiteContentBusyException()));

        var lost = await conflict.Update().HandleAsync(conflict.Entry.Id, Form(team: "Changed"), Token);
        var waited = await busy.Update().HandleAsync(busy.Entry.Id, Form(team: "Changed"), Token);

        lost.Error.ShouldBe(EditErrors.Stale);
        waited.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    [Fact]
    public async Task AnEditedUploadThatCannotBeReadBackIsANotFound()
    {
        var harness = new Harness();
        harness.Entries.GetItemAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<GalleryItemRow?>(null));

        var result = await harness.Update().HandleAsync(harness.Entry.Id, Form(), Token);

        result.Error.ShouldBe(SiteContentErrors.GalleryItemNotFound);
    }

    // Hide and show

    [Fact]
    public async Task HidingAShownUploadWritesTheHiddenEntryAndHidingAHiddenOneWritesNothing()
    {
        var harness = new Harness();

        var first = await harness.SetShown().HandleAsync(harness.Entry.Id, shown: false, Token);
        var second = await harness.SetShown().HandleAsync(harness.Entry.Id, shown: false, Token);

        first.IsSuccess.ShouldBeTrue();
        second.IsSuccess.ShouldBeTrue();
        harness.Entry.IsShown.ShouldBeFalse();
        harness.Unit.Saves.ShouldBe(1);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        (entry.Action, entry.Detail).ShouldBe((AuditActions.GalleryPhotoHidden, "team=Tondo Sample Riders;line=Moto Riding Jerseys"));
    }

    [Fact]
    public async Task ShowingAHiddenUploadWritesTheShownEntryAndAnUnknownLineTitleIsLeftEmpty()
    {
        var harness = new Harness();
        harness.Entry.Hide().ShouldBeTrue();
        harness.Lines.GetTitlesAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns(new Dictionary<Guid, string>());

        var result = await harness.SetShown().HandleAsync(harness.Entry.Id, shown: true, Token);

        result.IsSuccess.ShouldBeTrue();
        harness.Entry.IsShown.ShouldBeTrue();
        harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe("team=Tondo Sample Riders;line=");
    }

    [Fact]
    public async Task HidingOrShowingAnUploadThatIsGoneOrAnOrderItemIsA404AndALostRaceTwiceIsBusy()
    {
        var missing = new Harness();
        var raced = new Harness();
        raced.Unit.FailEverySaveWithConflict();

        // A real retry reads the row again, so each attempt gets a fresh shown upload.
        raced.Entries.FindUploadAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<GalleryEntry?>(NewUpload()));
        var gone = await missing.SetShown().HandleAsync(Guid.NewGuid(), shown: false, Token);
        var busy = await raced.SetShown().HandleAsync(raced.Entry.Id, shown: false, Token);

        gone.Error.ShouldBe(SiteContentErrors.GalleryItemNotFound);
        busy.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    // Delete

    [Fact]
    public async Task DeletingAnUploadRemovesItQueuesItsPhotoAndWritesTheDeletedEntry()
    {
        var harness = new Harness();

        var result = await harness.Delete().HandleAsync(harness.Entry.Id, Token);

        result.IsSuccess.ShouldBeTrue();
        harness.Entries.Received(1).Remove(harness.Entry);
        harness.Queue.Calls.ShouldBe([("csps-test/content/gallery/abc/old", ImageDeletionReason.PhotoDeleted)]);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        (entry.Action, entry.Detail).ShouldBe((AuditActions.GalleryPhotoDeleted, "team=Tondo Sample Riders;line=Moto Riding Jerseys"));
        entry.Detail!.ShouldNotContain("csps-test");
    }

    [Fact]
    public async Task DeletingAnUploadThatIsGoneOrAnOrderItemIsA404AndALostRaceTwiceIsBusy()
    {
        var missing = new Harness();
        var raced = new Harness();
        raced.Unit.FailEverySaveWithConflict();
        raced.Lines.GetTitlesAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns(new Dictionary<Guid, string>());

        var gone = await missing.Delete().HandleAsync(Guid.NewGuid(), Token);
        var busy = await raced.Delete().HandleAsync(raced.Entry.Id, Token);

        gone.Error.ShouldBe(SiteContentErrors.GalleryItemNotFound);
        busy.Error.ShouldBe(AuthErrors.SessionBusy);
        missing.Entries.DidNotReceiveWithAnyArgs().Remove(default!);
    }

    // Replace photo

    [Fact]
    public async Task ReplacingNeedsASessionStorageAndAFileBeforeAnythingIsRead()
    {
        var noSession = new Harness();
        noSession.Context.UserId.Returns((Guid?)null);
        var noStorage = new Harness();
        noStorage.Storage.IsConfigured.Returns(false);
        var noFile = new Harness();

        var session = await noSession.Replace().HandleAsync(noSession.Entry.Id, Photo, "p.jpg", Token);
        var storage = await noStorage.Replace().HandleAsync(noStorage.Entry.Id, Photo, "p.jpg", Token);
        var file = await noFile.Replace().HandleAsync(noFile.Entry.Id, ReadOnlyMemory<byte>.Empty, null, Token);

        session.Error.ShouldBe(AuthErrors.SessionEnded);
        storage.Error.ShouldBe(ImageErrors.NotConfigured);
        file.Error.ShouldBe(SiteContentErrors.GalleryPhotoMissing);
        file.Error.FieldErrors.ShouldNotBeNull()["file"].ShouldBe(["Choose a photo."]);
        noFile.StoredIds.ShouldBeEmpty();
    }

    [Fact]
    public async Task ReplacingTheOnlyPhotoOfAnUploadThatIsGoneOrAnOrderItemIsA404BeforeTheFileIsStored()
    {
        var missing = new Harness();
        var order = new Harness();
        order.Entries.GetItemAsync(order.Entry.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<GalleryItemRow?>(Row(order.Entry.Id, GalleryEntryKind.Order)));

        var gone = await missing.Replace().HandleAsync(Guid.NewGuid(), Photo, "p.jpg", Token);
        var item = await order.Replace().HandleAsync(order.Entry.Id, Photo, "p.jpg", Token);

        gone.Error.ShouldBe(SiteContentErrors.GalleryItemNotFound);
        item.Error.ShouldBe(SiteContentErrors.GalleryItemNotFound);
        missing.StoredIds.ShouldBeEmpty();
        order.StoredIds.ShouldBeEmpty();
    }

    [Fact]
    public async Task AFileThatIsNotAPhotoIsRefusedBeforeItReachesTheStorage()
    {
        var harness = new Harness();

        var result = await harness.Replace().HandleAsync(harness.Entry.Id, SyntheticImages.Svg(), "logo.jpg", Token);

        result.Error.Code.ShouldBe(ImageErrors.TypeCode);
        harness.StoredIds.ShouldBeEmpty();
    }

    [Fact]
    public async Task ASuccessfulReplaceStoresUnderTheEntrysFolderQueuesTheOldFileAndWritesAPhotoEntry()
    {
        var harness = new Harness();

        var result = await harness.Replace().HandleAsync(harness.Entry.Id, Photo, "p.jpg", Token);

        result.IsSuccess.ShouldBeTrue();
        var stored = harness.StoredIds.ShouldHaveSingleItem();
        stored.ShouldStartWith($"csps-test/content/gallery/{harness.Entry.Id:D}/");
        harness.Entry.PublicId.ShouldBe(stored);
        (harness.Entry.Width, harness.Entry.Height).ShouldBe((640, 480));
        harness.Queue.Calls.ShouldBe([("csps-test/content/gallery/abc/old", ImageDeletionReason.PhotoReplaced)]);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        (entry.Action, entry.Detail).ShouldBe((AuditActions.GalleryPhotoChanged, "fields=photo"));
        result.Value.Thumb.ShouldBe("https://images.example.test/t");
    }

    [Theory]
    [InlineData(ImageFailureCodes.Transient, 1)]
    [InlineData("refused", 0)]
    public async Task AFileTheStorageDidNotTakeIsAStorageFailureAndOnlyALostReplyQueuesIt(string code, int queued)
    {
        var harness = new Harness();
        harness.Storage.UploadAsync(Arg.Any<ImageUpload>(), Arg.Any<CancellationToken>()).Returns(ImageUploadOutcome.Failed(code));

        var result = await harness.Replace().HandleAsync(harness.Entry.Id, Photo, "p.jpg", Token);

        result.Error.ShouldBe(ImageErrors.StorageFailed);
        harness.Queue.Calls.Count.ShouldBe(queued);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AnUploadDeletedWhileTheFileWasUploadingIsA404AndTheNewFileIsQueuedAsUploadUndone()
    {
        var harness = new Harness();
        harness.Entries.FindUploadAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<GalleryEntry?>(null));

        var result = await harness.Replace().HandleAsync(harness.Entry.Id, Photo, "p.jpg", Token);

        result.Error.ShouldBe(SiteContentErrors.GalleryItemNotFound);
        harness.Queue.Calls.ShouldBe([(harness.StoredIds.ShouldHaveSingleItem(), ImageDeletionReason.UploadUndone)]);
    }

    [Fact]
    public async Task ASaveThatThrowsAfterTheFileWasStoredQueuesTheNewFileAndLetsTheErrorThrough()
    {
        var harness = new Harness();
        harness.Unit.ThrowOnSave(new InvalidOperationException("The database went away."));

        var error = await Should.ThrowAsync<InvalidOperationException>(() => harness.Replace().HandleAsync(harness.Entry.Id, Photo, "p.jpg", Token));

        error.Message.ShouldBe("The database went away.");
        harness.Queue.Calls.Last().ShouldBe((harness.StoredIds.ShouldHaveSingleItem(), ImageDeletionReason.UploadUndone));
    }

    [Fact]
    public async Task ALostRaceTwiceIsBusyAndAFailingQueueWriteDoesNotReplaceTheAnswer()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();
        harness.Queue.FailWith(new InvalidOperationException("The queue could not be written."));

        var result = await harness.Replace().HandleAsync(harness.Entry.Id, Photo, "p.jpg", Token);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    [Fact]
    public async Task AReplacedUploadThatCannotBeReadBackIsANotFound()
    {
        var harness = new Harness();
        harness.Entries.GetItemAsync(harness.Entry.Id, Arg.Any<CancellationToken>()).Returns(
            Task.FromResult<GalleryItemRow?>(Row(harness.Entry.Id)),
            Task.FromResult<GalleryItemRow?>(null));

        var result = await harness.Replace().HandleAsync(harness.Entry.Id, Photo, "p.jpg", Token);

        result.Error.ShouldBe(SiteContentErrors.GalleryItemNotFound);
    }
}
