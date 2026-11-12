using Csps.Application.Auth;
using Csps.Application.Content;
using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Content;
using NSubstitute;

namespace Csps.Application.UnitTests.Content;

/// <summary>
/// D-02, AUDIT-01, JOB-02, PUB-02: the line photo remove handler writes the row removal, the queued file and one audit entry in one
/// transaction under the site-content lock; the delete of a line takes the same lock; the slot words and the photo mapper give the
/// addresses the screens use and never a broken one.
/// </summary>
public sealed class ProductLinePhotoHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 9, 0, 0, TimeSpan.Zero);
    private static readonly Guid LineId = ProductLineSeed.All[0].Id;
    private static readonly ImageSource Source = new("https://images.example.test/a", "https://images.example.test/a 640w");

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static ProductLinePhoto Photo(ProductLinePhotoSlot slot = ProductLinePhotoSlot.Main) =>
        ProductLinePhoto.Create(LineId, slot, $"csps-test/content/lines/{LineId:D}/photophotophotophotophoto2", 640, 480, 1000, "jpg", Now);

    // -- remove ---------------------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task RemovingDeletesTheRowQueuesTheFileAndWritesOneAuditEntryInOneTransactionAfterTheLock()
    {
        var harness = new Harness();
        var photo = Photo();
        harness.Lines.FindPhotoAsync(LineId, ProductLinePhotoSlot.Main, Arg.Any<CancellationToken>()).Returns(Task.FromResult<ProductLinePhoto?>(photo));

        var result = await harness.Remove.HandleAsync(LineId, ProductLinePhotoSlot.Main, Token);

        result.IsSuccess.ShouldBeTrue();
        harness.Lines.Received(1).RemovePhoto(photo);
        harness.Queue.Received(1).Enqueue(photo.PublicId, ImageDeletionReason.PhotoDeleted);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        (entry.Action, entry.TargetType, entry.TargetId).ShouldBe((AuditActions.ProductLinePhotoChanged, "ProductLine", LineId.ToString("D")));
        entry.Detail.ShouldBe("key=basketball;title=Basketball Jerseys;slot=main;change=removed");
        harness.Unit.Commits.ShouldBe(1);
        Received.InOrder(() =>
        {
            harness.SiteLock.TakeAsync(Arg.Any<CancellationToken>());
            harness.Lines.FindAsync(LineId, Arg.Any<CancellationToken>());
        });
    }

    [Fact]
    public async Task RemovingFromAnEmptySlotOrAMissingLineIs404AndChangesNothing()
    {
        var harness = new Harness();

        var empty = await harness.Remove.HandleAsync(LineId, ProductLinePhotoSlot.Fabric, Token);
        harness.Lines.FindAsync(LineId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<ProductLine?>(null));
        var missing = await harness.Remove.HandleAsync(LineId, ProductLinePhotoSlot.Main, Token);

        empty.Error.ShouldBe(SiteContentErrors.PhotoNotFound);
        missing.Error.ShouldBe(SiteContentErrors.LineNotFound);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Queue.DidNotReceiveWithAnyArgs().Enqueue(default!, default);
    }

    [Fact]
    public async Task ARemovalThatCannotGetTheLockOrLosesARaceTwiceAnswersBusy()
    {
        var harness = new Harness();
        harness.SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(Task.FromException(new SiteContentBusyException()));
        var lockBusy = await harness.Remove.HandleAsync(LineId, ProductLinePhotoSlot.Main, Token);

        var raced = new Harness();
        raced.Lines.FindPhotoAsync(LineId, ProductLinePhotoSlot.Main, Arg.Any<CancellationToken>()).Returns(Task.FromResult<ProductLinePhoto?>(Photo()));
        raced.Unit.FailEverySaveWithConflict();
        var lost = await raced.Remove.HandleAsync(LineId, ProductLinePhotoSlot.Main, Token);

        lockBusy.Error.ShouldBe(AuthErrors.SessionBusy);
        lost.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    // -- delete of a line -----------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task DeletingALineTakesTheSiteContentLockBeforeItLooksAtWhatIsFiledUnderIt()
    {
        var harness = new Harness();
        harness.Lines.GetUsageAsync(LineId, Arg.Any<CancellationToken>()).Returns(new ProductLineUsage(0, 0, 0));

        var result = await harness.Delete.HandleAsync(LineId, Token);

        result.IsSuccess.ShouldBeTrue();
        Received.InOrder(() =>
        {
            harness.SiteLock.TakeAsync(Arg.Any<CancellationToken>());
            harness.Lines.FindAsync(LineId, Arg.Any<CancellationToken>());
            harness.Lines.GetUsageAsync(LineId, Arg.Any<CancellationToken>());
        });
    }

    [Fact]
    public async Task ADeleteThatCannotGetTheSiteContentLockAnswersBusy()
    {
        var harness = new Harness();
        harness.SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(Task.FromException(new SiteContentBusyException()));

        var result = await harness.Delete.HandleAsync(LineId, Token);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    // -- slot words -----------------------------------------------------------------------------------------------------------------

    [Theory]
    [InlineData("main", ProductLinePhotoSlot.Main)]
    [InlineData("Back", ProductLinePhotoSlot.Back)]
    [InlineData("FABRIC", ProductLinePhotoSlot.Fabric)]
    public void TheThreeSlotWordsAreReadWithoutRegardToLetterCaseAndWrittenBack(string text, ProductLinePhotoSlot expected)
    {
        ProductLinePhotoSlots.TryParse(text, out var slot).ShouldBeTrue();
        slot.ShouldBe(expected);
        ProductLinePhotoSlots.ToText(expected).ShouldBe(text.ToLowerInvariant());
    }

    [Theory]
    [InlineData("front")]
    [InlineData("")]
    [InlineData(null)]
    public void AnyOtherWordIsNotASlot(string? text)
    {
        ProductLinePhotoSlots.TryParse(text, out _).ShouldBeFalse();
    }

    [Fact]
    public void ANumberThatIsNotASlotCannotBeWrittenAsAWord()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => ProductLinePhotoSlots.ToText((ProductLinePhotoSlot)9));
    }

    // -- mapper ---------------------------------------------------------------------------------------------------------------------

    [Fact]
    public void TheMainPhotoUsesTheCardCandidatesForTheManagerAndTheLargeOnesForAVisitorAndTheOthersTheSmallOnes()
    {
        var card = new ImageSource("card", "card 320w");
        var large = new ImageSource("large", "large 800w");
        var small = new ImageSource("small", "small 400w");
        var delivery = Substitute.For<IImageDelivery>();
        delivery.ForLinePhoto(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<int>()).Returns(new LinePhotoUrls(card, large, small, "thumb"));

        ProductLinePhotoMapper.ToAdmin(Photo(), delivery).ShouldBe(new ProductLinePhotoDto("main", "card", "card 320w", 640, 480));
        ProductLinePhotoMapper.ToAdmin(Photo(ProductLinePhotoSlot.Back), delivery).ShouldBe(new ProductLinePhotoDto("back", "small", "small 400w", 640, 480));
        ProductLinePhotoMapper.ToPublic(Photo(), delivery).ShouldBe(new PublicPhotoDto("large", "large 800w", 640, 480));
        ProductLinePhotoMapper.ToPublic(Photo(ProductLinePhotoSlot.Fabric), delivery).ShouldBe(new PublicPhotoDto("small", "small 400w", 640, 480));
        ProductLinePhotoMapper.ToThumb(Photo(), delivery).ShouldBe("thumb");
    }

    [Fact]
    public void TheEditorGetsEachSlotItsOwnPhotoAndAnEmptySlotIsNull()
    {
        var delivery = Substitute.For<IImageDelivery>();
        delivery.ForLinePhoto(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<int>()).Returns(new LinePhotoUrls(Source, Source, Source, "thumb"));

        var photos = ProductLinePhotoMapper.ToAdminSlots([Photo(ProductLinePhotoSlot.Fabric), Photo(ProductLinePhotoSlot.Main)], delivery);

        photos.Main.ShouldNotBeNull().Slot.ShouldBe("main");
        photos.Back.ShouldBeNull();
        photos.Fabric.ShouldNotBeNull().Slot.ShouldBe("fabric");
        ProductLinePhotoMapper.ToAdminSlots(null, delivery).ShouldBeSameAs(ProductLinePhotosDto.None);
        ProductLinePhotoMapper.ToAdminSlots([], delivery).ShouldBeSameAs(ProductLinePhotosDto.None);
    }

    [Fact]
    public void ADeliveryWithNoAddressGivesNoPhotoAndNoThumbSoThePageShowsTheDrawing()
    {
        var empty = new ImageSource(string.Empty, string.Empty);
        var delivery = Substitute.For<IImageDelivery>();
        delivery.ForLinePhoto(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<int>()).Returns(new LinePhotoUrls(empty, empty, empty, string.Empty));

        ProductLinePhotoMapper.ToPublic(Photo(), delivery).ShouldBeNull();
        ProductLinePhotoMapper.ToThumb(Photo(), delivery).ShouldBeNull();
        ProductLinePhotoMapper.ToThumb(null, delivery).ShouldBeNull();
    }

    [Fact]
    public void TheMapperAndTheAuditDetailGuardTheirArguments()
    {
        var delivery = Substitute.For<IImageDelivery>();
        Should.Throw<ArgumentNullException>(() => ProductLinePhotoMapper.ToAdmin((ProductLinePhoto)null!, delivery));
        Should.Throw<ArgumentNullException>(() => ProductLinePhotoMapper.ToAdmin(Photo(), null!));
        Should.Throw<ArgumentNullException>(() => ProductLinePhotoMapper.ToPublic(null!, delivery));
        Should.Throw<ArgumentNullException>(() => ProductLinePhotoMapper.ToPublic(Photo(), null!));
        Should.Throw<ArgumentNullException>(() => ProductLinePhotoMapper.ToThumb(Photo(), null!));
        Should.Throw<ArgumentNullException>(() => ProductLineAuditDetail.PhotoChanged(null!, ProductLinePhotoSlot.Main, "added"));
        Should.Throw<ArgumentNullException>(() => ProductLineAuditDetail.PhotoChanged(ProductLine.FromSeed(ProductLineSeed.All[0], null, null, Now), ProductLinePhotoSlot.Main, null!));
    }

    private sealed class Harness
    {
        public Harness()
        {
            var line = ProductLine.FromSeed(ProductLineSeed.All[0], null, null, Now);
            Lines = Substitute.For<IProductLines>();
            Lines.FindAsync(LineId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<ProductLine?>(line));
            Lines.FindPhotoAsync(Arg.Any<Guid>(), Arg.Any<ProductLinePhotoSlot>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<ProductLinePhoto?>(null));
            SiteLock = Substitute.For<ISiteContentLock>();
            SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
            Queue = Substitute.For<IImageDeletionQueue>();
            Remove = new RemoveProductLinePhotoHandler(Lines, SiteLock, Audit, Unit, Queue);
            Delete = new DeleteProductLineHandler(Lines, SiteLock, Audit, Unit);
        }

        public IProductLines Lines { get; }

        public ISiteContentLock SiteLock { get; }

        public IImageDeletionQueue Queue { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public RemoveProductLinePhotoHandler Remove { get; }

        public DeleteProductLineHandler Delete { get; }
    }
}
