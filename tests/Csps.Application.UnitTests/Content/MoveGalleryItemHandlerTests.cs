using Csps.Application.Auth;
using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Content;
using NSubstitute;

namespace Csps.Application.UnitTests.Content;

/// <summary>GAL-03, D-14, T-11-72: a gallery move swaps with the visible neighbour, or the next item of the filtered line, under the site-content lock.</summary>
public sealed class MoveGalleryItemHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 9, 0, 0, TimeSpan.Zero);
    private static readonly Guid Moto = Guid.Parse("b3d5f7a9-1c2e-4a60-8b94-5d7e9f1a3c20");
    private static readonly Guid Basketball = Guid.Parse("c4e6a8b0-2d3f-4b71-9ca5-6e8f0a2b4d31");

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static GalleryEntry Upload(int position) => GalleryEntry.CreateUpload(
        GalleryEntry.NewId(Now),
        new GalleryUploadValues("Sample", Moto, null, null, true),
        new LinePhotoFile("csps/content/gallery/abc/def", 800, 600, 1000, "jpg"),
        position,
        Now).Value;

    // [A moto upload, B basketball order, C moto upload] at places 10, 20 and 30.
    private sealed class Harness
    {
        public Harness()
        {
            A = Upload(10);
            B = GalleryEntry.ForOrder(Guid.NewGuid(), 20, Now);
            C = Upload(30);
            Entries = Substitute.For<IGalleryEntries>();
            Entries.ListOrderAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult<IReadOnlyList<GalleryOrderRef>>(
            [
                new(A.Id, GalleryEntryKind.Upload, "Alpha Sample", Moto),
                new(B.Id, GalleryEntryKind.Order, "Bravo Sample Ballers", Basketball),
                new(C.Id, GalleryEntryKind.Upload, "Charlie Sample", Moto),
            ]));
            foreach (var entry in new[] { A, B, C })
            {
                Entries.FindAsync(entry.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<GalleryEntry?>(entry));
            }

            SiteLock = Substitute.For<ISiteContentLock>();
            SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
            Handler = new MoveGalleryItemHandler(Entries, SiteLock, Audit, Unit, new MoveGalleryItemRequestValidator());
        }

        public GalleryEntry A { get; }

        public GalleryEntry B { get; }

        public GalleryEntry C { get; }

        public IGalleryEntries Entries { get; }

        public ISiteContentLock SiteLock { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public MoveGalleryItemHandler Handler { get; }
    }

    [Fact]
    public async Task MovingTheLastItemUpSwapsItWithItsNeighbourAndWritesTheMovedEntryWithTheKindNameAndPlaces()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.C.Id, new MoveGalleryItemRequest("up"), Token);

        result.IsSuccess.ShouldBeTrue();
        (harness.C.Position, harness.B.Position, harness.A.Position).ShouldBe((20, 30, 10));
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        (entry.Action, entry.TargetType, entry.TargetId, entry.Detail).ShouldBe((AuditActions.GalleryItemMoved, "GalleryEntry", harness.C.Id.ToString("D"), "kind=upload;name=Charlie Sample;position=3>2"));
        harness.Unit.Saves.ShouldBe(1);
        await harness.SiteLock.Received(1).TakeAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnOrderItemMovesDownAndNamesItsKind()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.B.Id, new MoveGalleryItemRequest("DOWN"), Token);

        result.IsSuccess.ShouldBeTrue();
        (harness.B.Position, harness.C.Position).ShouldBe((30, 20));
        harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe("kind=order;name=Bravo Sample Ballers;position=2>3");
    }

    [Fact]
    public async Task WithALineFilterTheNeighbourIsTheNextItemOfThatLineAndTheAuditPlacesAreInTheWholeList()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.C.Id, new MoveGalleryItemRequest("up", Moto), Token);

        result.IsSuccess.ShouldBeTrue();
        (harness.C.Position, harness.A.Position, harness.B.Position).ShouldBe((10, 30, 20));
        harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe("kind=upload;name=Charlie Sample;position=3>1");
    }

    [Theory]
    [InlineData(0, "up", null)]
    [InlineData(2, "down", null)]
    [InlineData(0, "up", "moto")]
    [InlineData(2, "down", "moto")]
    public async Task TheTopItemUpAndTheLastItemDownChangeAndRecordNothing(int index, string direction, string? line)
    {
        var harness = new Harness();
        var id = new[] { harness.A, harness.B, harness.C }[index].Id;

        var result = await harness.Handler.HandleAsync(id, new MoveGalleryItemRequest(direction, line is null ? null : Moto), Token);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
        (harness.A.Position, harness.B.Position, harness.C.Position).ShouldBe((10, 20, 30));
    }

    [Theory]
    [InlineData("sideways")]
    [InlineData(null)]
    [InlineData("")]
    public async Task ABadDirectionIs400AndTheStoreIsNeverRead(string? direction)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.C.Id, new MoveGalleryItemRequest(direction), Token);

        result.Error.Code.ShouldBe(SiteContentErrors.InvalidCode);
        await harness.Entries.DidNotReceiveWithAnyArgs().ListOrderAsync(Token);
    }

    [Fact]
    public async Task AnItemThatIsNotInTheListOrNotInTheFilteredLineIsA404()
    {
        var harness = new Harness();

        var unknown = await harness.Handler.HandleAsync(Guid.NewGuid(), new MoveGalleryItemRequest("up"), Token);
        var outside = await harness.Handler.HandleAsync(harness.B.Id, new MoveGalleryItemRequest("up", Moto), Token);

        unknown.Error.ShouldBe(SiteContentErrors.GalleryItemNotFound);
        outside.Error.ShouldBe(SiteContentErrors.GalleryItemNotFound);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnEntryThatVanishedBetweenTheListAndTheLoadIsA404()
    {
        var harness = new Harness();
        harness.Entries.FindAsync(harness.B.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<GalleryEntry?>(null));
        var neighbourGone = await harness.Handler.HandleAsync(harness.C.Id, new MoveGalleryItemRequest("up"), Token);
        harness.Entries.FindAsync(harness.C.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<GalleryEntry?>(null));
        harness.Entries.FindAsync(harness.B.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<GalleryEntry?>(harness.B));
        var itemGone = await harness.Handler.HandleAsync(harness.C.Id, new MoveGalleryItemRequest("up"), Token);

        neighbourGone.Error.ShouldBe(SiteContentErrors.GalleryItemNotFound);
        itemGone.Error.ShouldBe(SiteContentErrors.GalleryItemNotFound);
    }

    [Fact]
    public async Task ALostRaceTwiceAndABusyLockAreBusy()
    {
        var raced = new Harness();
        raced.Unit.FailEverySaveWithConflict();
        var busy = new Harness();
        busy.SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(Task.FromException(new SiteContentBusyException()));

        var lost = await raced.Handler.HandleAsync(raced.C.Id, new MoveGalleryItemRequest("up"), Token);
        var waited = await busy.Handler.HandleAsync(busy.C.Id, new MoveGalleryItemRequest("up"), Token);

        lost.Error.ShouldBe(AuthErrors.SessionBusy);
        waited.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    [Fact]
    public async Task ARequestOfNullIsRefused()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Handler.HandleAsync(harness.C.Id, null!, Token));
    }
}
