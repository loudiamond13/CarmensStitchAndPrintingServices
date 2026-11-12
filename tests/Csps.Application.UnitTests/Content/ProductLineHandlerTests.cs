using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Content;
using Csps.Domain.OrderLists;
using FluentValidation;
using NSubstitute;

namespace Csps.Application.UnitTests.Content;

/// <summary>
/// CONT-02, SEC-07, AUDIT-01, D-08, D-09, T-11-43: the product line handlers take the site-content lock before they decide, refuse a
/// short name another line uses, file product types, write one audit entry per change, read again once when a save loses a race, and
/// delete only an unused line.
/// </summary>
public sealed class ProductLineHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 9, 0, 0, TimeSpan.Zero);
    private static readonly byte[] Version = [0, 0, 0, 0, 0, 0, 0x1F, 0xA4];
    private static readonly string VersionText = RowVersions.ToText(Version);

    private static readonly ProductLineRequest Valid = new(
        "Shorts", "Shorts", "7", "Card text", "Description", "Fabric", "Collar", "Cut", "Names", "Logos", null, null, false, null, null);

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static ProductLine Line(string key = "shorts", int position = 7, bool active = false, string title = "Shorts")
    {
        var line = ProductLine.Create(Valid.ToValues() with { Title = title, IsActive = active }, key, position, Now).Value;
        typeof(ProductLine).GetProperty(nameof(ProductLine.RowVersion))!.SetValue(line, Version);
        return line;
    }

    // A store that reads again hands out a row in its stored state, not the one an earlier attempt changed.
    private static ProductLine FreshCopy(ProductLine line) => Line(line.Key, line.Position, active: true, line.Title);

    private static ProductType Type(int index) => ProductType.FromSeed(OrderListSeed.ProductTypes[index]);

    private static ProductLineDetailRow Detail(ProductLine line, params Guid[] typeIds) => new(line, typeIds, null);

    // -- list and read --------------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task TheListMapsEveryRowAndOnlyAnUnusedLineCanBeDeleted()
    {
        var harness = new Harness();
        var unused = Line("a", 1);
        var withPhoto = Line("b", 2);
        var withType = Line("c", 3);
        var withGallery = Line("d", 4);
        var typeId = Guid.NewGuid();
        harness.Lines.ListAsync(Arg.Any<CancellationToken>()).Returns(
        [
            new ProductLineListRow(unused, [], 0, 0),
            new ProductLineListRow(withPhoto, [], 2, 0),
            new ProductLineListRow(withType, [typeId], 0, 0),
            new ProductLineListRow(withGallery, [], 0, 3),
        ]);

        var result = await harness.List.HandleAsync(Token);

        result.Value.Select(item => item.CanDelete).ShouldBe([true, false, false, false]);
        result.Value[1].PhotoCount.ShouldBe(2);
        result.Value[2].ProductTypeIds.ShouldBe([typeId]);
        result.Value[3].ShownGalleryCount.ShouldBe(3);
        result.Value[0].Version.ShouldBe(VersionText);
        result.Value[0].MainPhotoThumb.ShouldBeNull();
    }

    [Fact]
    public async Task ReadingALineMapsEveryFieldAndNamesTheDrawingInCamelCase()
    {
        var harness = new Harness();
        var line = ProductLine.FromSeed(ProductLineSeed.All[3], 650m, 10, Now);
        harness.Lines.GetDetailAsync(line.Id, Arg.Any<CancellationToken>()).Returns(new ProductLineDetailRow(line, [], "Paolo Reyes"));

        var result = await harness.Get.HandleAsync(line.Id, Token);

        result.Value.PlaceholderArt.ShouldBe("longSleeves");
        result.Value.Key.ShouldBe("longsleeves");
        result.Value.StartsAtPrice.ShouldBe(650m);
        result.Value.MinimumQuantity.ShouldBe(10);
        result.Value.UpdatedByName.ShouldBe("Paolo Reyes");
        result.Value.CreatedAtUtc.ShouldBe(Now);
    }

    [Fact]
    public async Task ReadingAnUnknownLineIs404()
    {
        var harness = new Harness();
        harness.Lines.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<ProductLineDetailRow?>(null));

        var result = await harness.Get.HandleAsync(Guid.NewGuid(), Token);

        result.Error.ShouldBe(SiteContentErrors.LineNotFound);
        result.Error.Message.ShouldBe("This product line wasn't found.");
    }

    // -- add ------------------------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task AddingTakesTheLockThenChecksTheShortNameThenAddsAndWritesOneAuditEntry()
    {
        var harness = new Harness();

        var result = await harness.Create.HandleAsync(Valid, Token);

        result.IsSuccess.ShouldBeTrue();
        Received.InOrder(() =>
        {
            harness.SiteLock.TakeAsync(Arg.Any<CancellationToken>());
            harness.Lines.ShortNameTakenAsync("Shorts", null, Arg.Any<CancellationToken>());
            harness.Lines.Add(Arg.Any<ProductLine>());
        });
        harness.Unit.Saves.ShouldBe(1);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.ProductLineAdded);
        entry.TargetType.ShouldBe("ProductLine");
        entry.Detail.ShouldBe("key=shorts;title=Shorts");
        harness.Added.ShouldHaveSingleItem().Position.ShouldBe(7);
    }

    [Fact]
    public async Task AddingMakesTheKeyUniqueAgainstTheExistingKeys()
    {
        var harness = new Harness();
        harness.Lines.GetKeysAsync(Arg.Any<CancellationToken>()).Returns(new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "shorts" });

        await harness.Create.HandleAsync(Valid, Token);

        harness.Added.Single().Key.ShouldBe("shorts-2");
    }

    [Fact]
    public async Task AShortNameAnotherLineUsesIs400OnShortNameAndAddsNothing()
    {
        var harness = new Harness();
        harness.Lines.ShortNameTakenAsync(Arg.Any<string>(), Arg.Any<Guid?>(), Arg.Any<CancellationToken>()).Returns(true);

        var result = await harness.Create.HandleAsync(Valid with { ShortName = " Shorts " }, Token);

        result.Error.FieldErrors!["shortName"].ShouldBe(["Another product line already uses this short name."]);
        harness.Added.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
        await harness.Lines.Received().ShortNameTakenAsync("Shorts", null, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AFormTheValidatorRefusesNeverTakesTheLock()
    {
        var harness = new Harness();

        var result = await harness.Create.HandleAsync(ProductLineRequest.Empty, Token);

        result.Error.Code.ShouldBe(SiteContentErrors.InvalidCode);
        result.Error.FieldErrors!["title"].ShouldBe(["Enter the title."]);
        _ = harness.SiteLock.DidNotReceive().TakeAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AFormTheDomainRefusesAfterTheValidatorPassedIs400AndAddsNothing()
    {
        var harness = new Harness(new PassingValidator());

        var result = await harness.Create.HandleAsync(Valid with { Title = "", ShortName = "Shorts" }, Token);

        result.Error.FieldErrors!["title"].ShouldBe(["Enter the title."]);
        harness.Added.ShouldBeEmpty();
    }

    [Fact]
    public async Task AnUnknownTickedProductTypeIs400OnProductTypeIdsAndAddsNothing()
    {
        var harness = new Harness();
        harness.Lines.FindTypesAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns([]);

        var result = await harness.Create.HandleAsync(Valid with { ProductTypeIds = [Guid.NewGuid()] }, Token);

        result.Error.FieldErrors!["productTypeIds"].ShouldBe(["Reload the form and try again."]);
        harness.Added.ShouldBeEmpty();
    }

    [Fact]
    public async Task AddingFilesTheTickedProductTypesUnderTheNewLineWithTheirOwnAuditEntries()
    {
        var harness = new Harness();
        var type = Type(0);
        harness.Lines.FindTypesAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns([type]);

        var result = await harness.Create.HandleAsync(Valid with { ProductTypeIds = [type.Id, type.Id] }, Token);

        result.IsSuccess.ShouldBeTrue();
        type.ProductLineId.ShouldBe(harness.Added.Single().Id);
        harness.Audit.Entries.Select(entry => entry.Action).ShouldBe([AuditActions.ProductLineAdded, AuditActions.ProductTypeLineLinked]);
        harness.Audit.Entries[1].TargetType.ShouldBe("ProductType");
        harness.Audit.Entries[1].Detail.ShouldBe("line=>Shorts");
    }

    [Fact]
    public async Task AnEmptyTickedListLooksUpNoProductTypes()
    {
        var harness = new Harness();

        await harness.Create.HandleAsync(Valid with { ProductTypeIds = [] }, Token);

        _ = harness.Lines.DidNotReceive().FindTypesAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddingWhenTheLockIsBusyAnswersTheSharedBusyLine()
    {
        var harness = new Harness();
        harness.SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(_ => Task.FromException(new SiteContentBusyException()));

        var result = await harness.Create.HandleAsync(Valid, Token);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AddingThatLosesARaceTwiceIsBusyAndOnceIsRetried()
    {
        var once = new Harness();
        once.Unit.FailFirstSaveWithConflict();
        var twice = new Harness();
        twice.Unit.FailEverySaveWithConflict();

        var recovered = await once.Create.HandleAsync(Valid, Token);
        var lost = await twice.Create.HandleAsync(Valid, Token);

        recovered.IsSuccess.ShouldBeTrue();
        lost.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    [Fact]
    public async Task AddingAnswersNotFoundWhenTheNewLineCannotBeReadBack()
    {
        var harness = new Harness();
        harness.Lines.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<ProductLineDetailRow?>(null));

        var result = await harness.Create.HandleAsync(Valid, Token);

        result.Error.ShouldBe(SiteContentErrors.LineNotFound);
    }

    // -- edit -----------------------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task EditingChangesTheLineWritesOneChangedEntryAndReturnsTheSavedLine()
    {
        var harness = new Harness();
        var line = Line();
        harness.Stored(line);

        var result = await harness.Update.HandleAsync(line.Id, Valid with { Title = "Short Shorts", StartsAtPrice = 350m, Version = VersionText }, Token);

        result.IsSuccess.ShouldBeTrue();
        Received.InOrder(() =>
        {
            harness.SiteLock.TakeAsync(Arg.Any<CancellationToken>());
            harness.Lines.FindAsync(line.Id, Arg.Any<CancellationToken>());
        });
        harness.Unit.Saves.ShouldBe(1);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.ProductLineChanged);
        entry.Detail.ShouldBe("fields=title,startsAtPrice;title=Shorts>Short Shorts;price=>350.00");
        line.Title.ShouldBe("Short Shorts");
    }

    [Fact]
    public async Task EditingWithNothingChangedSavesNothingAndWritesNoAuditEntry()
    {
        var harness = new Harness();
        var line = Line();
        harness.Stored(line);

        var result = await harness.Update.HandleAsync(line.Id, Valid with { Version = VersionText }, Token);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AFlipOfTheShownFlagWritesTheShownOrHiddenEntryAndNoChangedEntry()
    {
        var harness = new Harness();
        var line = Line();
        harness.Stored(line);

        await harness.Update.HandleAsync(line.Id, Valid with { IsActive = true, Version = VersionText }, Token);
        await harness.Update.HandleAsync(line.Id, Valid with { IsActive = false, Version = VersionText }, Token);

        harness.Audit.Entries.Select(entry => entry.Action).ShouldBe([AuditActions.ProductLineShown, AuditActions.ProductLineHidden]);
        harness.Audit.Entries.ShouldAllBe(entry => entry.Detail == "key=shorts;title=Shorts");
    }

    [Fact]
    public async Task EditingAnUnknownLineIs404AndAStaleVersionIs409()
    {
        var harness = new Harness();
        var line = Line();
        harness.Stored(line);

        var missing = await harness.Update.HandleAsync(Guid.NewGuid(), Valid with { Version = VersionText }, Token);
        var stale = await harness.Update.HandleAsync(line.Id, Valid with { Version = RowVersions.ToText([1, 2, 3, 4, 5, 6, 7, 8]) }, Token);

        missing.Error.ShouldBe(SiteContentErrors.LineNotFound);
        stale.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnEditWithoutAVersionIs400BeforeTheLockIsTaken()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(Guid.NewGuid(), Valid, Token);

        result.Error.FieldErrors!["version"].ShouldBe(["Reload the form and try again."]);
        _ = harness.SiteLock.DidNotReceive().TakeAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EditingToAShortNameAnotherLineUsesIs400LeavesTheRowUntouchedAndLeavesOutTheLineItself()
    {
        var harness = new Harness();
        var line = Line();
        harness.Stored(line);
        harness.Lines.ShortNameTakenAsync(Arg.Any<string>(), Arg.Any<Guid?>(), Arg.Any<CancellationToken>()).Returns(true);

        var result = await harness.Update.HandleAsync(line.Id, Valid with { Title = "Changed", ShortName = "Basketball", Version = VersionText }, Token);

        result.Error.FieldErrors!["shortName"].ShouldBe(["Another product line already uses this short name."]);
        line.Title.ShouldBe("Shorts");
        await harness.Lines.Received().ShortNameTakenAsync("Basketball", line.Id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EditingWithAnUnknownProductTypeIs400AndLeavesTheRowUntouched()
    {
        var harness = new Harness();
        var line = Line();
        harness.Stored(line);
        harness.Lines.FindTypesAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns([]);

        var result = await harness.Update.HandleAsync(line.Id, Valid with { Title = "Changed", ProductTypeIds = [Guid.NewGuid()], Version = VersionText }, Token);

        result.Error.FieldErrors!["productTypeIds"].ShouldBe(["Reload the form and try again."]);
        line.Title.ShouldBe("Shorts");
    }

    [Fact]
    public async Task AFormTheDomainRefusesAfterTheValidatorPassedIs400OnEdit()
    {
        var harness = new Harness(new PassingValidator());
        var line = Line();
        harness.Stored(line);

        var result = await harness.Update.HandleAsync(line.Id, Valid with { CardText = "", Version = VersionText }, Token);

        result.Error.FieldErrors!["cardText"].ShouldBe(["Enter the card text."]);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task TickedTypesAreFiledMovedAndFreedWithOneAuditEntryEachAndTheLineItselfIsNotSaved()
    {
        var harness = new Harness();
        var line = Line();
        harness.Stored(line);
        var otherLine = Guid.NewGuid();
        var unfiled = Type(0);
        var moving = Type(1);
        moving.LinkToLine(otherLine);
        var freed = Type(2);
        freed.LinkToLine(line.Id);
        var kept = Type(3);
        kept.LinkToLine(line.Id);
        harness.Lines.FindTypesAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns([unfiled, moving, kept]);
        harness.Lines.GetLinkedTypesAsync(line.Id, Arg.Any<CancellationToken>()).Returns([freed, kept]);
        harness.Lines.GetTitlesAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, string> { [otherLine] = "Volleyball Jerseys" });

        var result = await harness.Update.HandleAsync(line.Id, Valid with { ProductTypeIds = [unfiled.Id, moving.Id, kept.Id], Version = VersionText }, Token);

        result.IsSuccess.ShouldBeTrue();
        unfiled.ProductLineId.ShouldBe(line.Id);
        moving.ProductLineId.ShouldBe(line.Id);
        freed.ProductLineId.ShouldBeNull();
        kept.ProductLineId.ShouldBe(line.Id);
        harness.Audit.Entries.Select(entry => (entry.TargetId, entry.Detail)).ShouldBe(
        [
            (AuditKey.Of(unfiled.Id), "line=>Shorts"),
            (AuditKey.Of(moving.Id), "line=Volleyball Jerseys>Shorts"),
            (AuditKey.Of(freed.Id), "line=Shorts>"),
        ]);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task ATypeFiledUnderALineThatNoLongerExistsHasNoOldTitle()
    {
        var harness = new Harness();
        var line = Line();
        harness.Stored(line);
        var orphan = Type(0);
        orphan.LinkToLine(Guid.NewGuid());
        harness.Lines.FindTypesAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns([orphan]);
        harness.Lines.GetTitlesAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns(new Dictionary<Guid, string>());

        await harness.Update.HandleAsync(line.Id, Valid with { ProductTypeIds = [orphan.Id], Version = VersionText }, Token);

        harness.Audit.Entries.Single().Detail.ShouldBe("line=>Shorts");
    }

    [Fact]
    public async Task AnEditThatLeavesTheProductTypeListOutNeverReadsTheLinks()
    {
        var harness = new Harness();
        var line = Line();
        harness.Stored(line);

        await harness.Update.HandleAsync(line.Id, Valid with { Title = "Changed", Version = VersionText }, Token);

        _ = harness.Lines.DidNotReceive().GetLinkedTypesAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EditingWhenTheLockIsBusyIsTheSharedBusyLineAndALostSaveIsStale()
    {
        var busy = new Harness();
        busy.SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(_ => Task.FromException(new SiteContentBusyException()));
        var lost = new Harness();
        var line = Line();
        lost.Stored(line);
        lost.Unit.FailEverySaveWithConflict();

        var busyResult = await busy.Update.HandleAsync(Guid.NewGuid(), Valid with { Version = VersionText }, Token);
        var lostResult = await lost.Update.HandleAsync(line.Id, Valid with { Title = "Changed", Version = VersionText }, Token);

        busyResult.Error.ShouldBe(AuthErrors.SessionBusy);
        lostResult.Error.ShouldBe(EditErrors.Stale);
    }

    [Fact]
    public async Task EditingAnswersNotFoundWhenTheSavedLineCannotBeReadBack()
    {
        var harness = new Harness();
        var line = Line();
        harness.Stored(line);
        harness.Lines.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<ProductLineDetailRow?>(null));

        var result = await harness.Update.HandleAsync(line.Id, Valid with { Version = VersionText }, Token);

        result.Error.ShouldBe(SiteContentErrors.LineNotFound);
    }

    // -- move -----------------------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task MovingUpTakesTheLockSwapsWithTheNeighbourAndWritesOneMovedEntry()
    {
        var harness = new Harness();
        var line = Line("b", 2, title: "Second");
        var neighbour = Line("a", 1, title: "First");
        harness.Stored(line);
        harness.Lines.FindNeighbourAsync(line, true, Arg.Any<CancellationToken>()).Returns(neighbour);

        var result = await harness.Move.HandleAsync(line.Id, new MoveProductLineRequest("up"), Token);

        result.IsSuccess.ShouldBeTrue();
        Received.InOrder(() =>
        {
            harness.SiteLock.TakeAsync(Arg.Any<CancellationToken>());
            harness.Lines.FindAsync(line.Id, Arg.Any<CancellationToken>());
        });
        (line.Position, neighbour.Position).ShouldBe((1, 2));
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.ProductLineMoved);
        entry.Detail.ShouldBe("title=Second;position=2>1");
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task MovingDownAsksForTheNextLine()
    {
        var harness = new Harness();
        var line = Line("a", 1);
        harness.Stored(line);
        harness.Lines.FindNeighbourAsync(line, false, Arg.Any<CancellationToken>()).Returns(Line("b", 2));

        var result = await harness.Move.HandleAsync(line.Id, new MoveProductLineRequest("Down"), Token);

        result.IsSuccess.ShouldBeTrue();
        line.Position.ShouldBe(2);
    }

    [Fact]
    public async Task MovingAtTheEndOfTheOrderSavesAndRecordsNothing()
    {
        var harness = new Harness();
        var line = Line("a", 1);
        harness.Stored(line);

        var result = await harness.Move.HandleAsync(line.Id, new MoveProductLineRequest("up"), Token);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task MovingAnUnknownLineIs404AndABadDirectionIs400BeforeTheLock()
    {
        var harness = new Harness();

        var missing = await harness.Move.HandleAsync(Guid.NewGuid(), new MoveProductLineRequest("up"), Token);
        var bad = await harness.Move.HandleAsync(Guid.NewGuid(), MoveProductLineRequest.Empty, Token);

        missing.Error.ShouldBe(SiteContentErrors.LineNotFound);
        bad.Error.FieldErrors!["direction"].ShouldBe(["Check the highlighted fields."]);
        await harness.SiteLock.Received(1).TakeAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task MovingWhenTheLockIsBusyIsBusyAndLosingARaceTwiceIsBusyAndOnceIsRetried()
    {
        var busy = new Harness();
        busy.SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(_ => Task.FromException(new SiteContentBusyException()));
        var once = new Harness();
        var onceLine = Line("a", 2);
        once.Stored(onceLine);
        once.Lines.FindNeighbourAsync(onceLine, true, Arg.Any<CancellationToken>()).Returns(Line("b", 1));
        once.Unit.FailFirstSaveWithConflict();
        var twice = new Harness();
        var twiceLine = Line("a", 2);
        twice.Stored(twiceLine);
        twice.Lines.FindNeighbourAsync(twiceLine, true, Arg.Any<CancellationToken>()).Returns(Line("b", 1));
        twice.Unit.FailEverySaveWithConflict();

        var busyResult = await busy.Move.HandleAsync(Guid.NewGuid(), new MoveProductLineRequest("up"), Token);
        var recovered = await once.Move.HandleAsync(onceLine.Id, new MoveProductLineRequest("up"), Token);
        var lost = await twice.Move.HandleAsync(twiceLine.Id, new MoveProductLineRequest("up"), Token);

        busyResult.Error.ShouldBe(AuthErrors.SessionBusy);
        recovered.IsSuccess.ShouldBeTrue();
        lost.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    // -- hide and show --------------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task HidingAndShowingFlipTheFlagAndWriteOneEntryEach()
    {
        var harness = new Harness();
        var line = Line(active: true);
        harness.Stored(line);

        var hidden = await harness.SetShown.HandleAsync(line.Id, shown: false, Token);
        var shown = await harness.SetShown.HandleAsync(line.Id, shown: true, Token);

        hidden.IsSuccess.ShouldBeTrue();
        shown.IsSuccess.ShouldBeTrue();
        line.IsActive.ShouldBeTrue();
        harness.Audit.Entries.Select(entry => entry.Action).ShouldBe([AuditActions.ProductLineHidden, AuditActions.ProductLineShown]);
        harness.Audit.Entries.ShouldAllBe(entry => entry.Detail == "key=shorts;title=Shorts");
        harness.Unit.Saves.ShouldBe(2);
    }

    [Fact]
    public async Task HidingAHiddenLineOrShowingAShownLineSavesAndRecordsNothing()
    {
        var harness = new Harness();
        var hiddenLine = Line();
        harness.Stored(hiddenLine);

        var hide = await harness.SetShown.HandleAsync(hiddenLine.Id, shown: false, Token);

        hide.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task HidingAnUnknownLineIs404AndLosingARaceTwiceIsBusy()
    {
        var harness = new Harness();
        var lost = new Harness();
        var line = Line(active: true);
        lost.Lines.FindAsync(line.Id, Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<ProductLine?>(FreshCopy(line)));
        lost.Unit.FailEverySaveWithConflict();

        var missing = await harness.SetShown.HandleAsync(Guid.NewGuid(), shown: false, Token);
        var busy = await lost.SetShown.HandleAsync(line.Id, shown: false, Token);

        missing.Error.ShouldBe(SiteContentErrors.LineNotFound);
        busy.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    // -- delete ---------------------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task DeletingAnUnusedLineWritesTheDeletedEntryAndRemovesTheRow()
    {
        var harness = new Harness();
        var line = Line();
        harness.Stored(line);

        var result = await harness.Delete.HandleAsync(line.Id, Token);

        result.IsSuccess.ShouldBeTrue();
        harness.Lines.Received(1).Remove(line);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.ProductLineDeleted);
        entry.Detail.ShouldBe("key=shorts;title=Shorts");
        harness.Unit.Saves.ShouldBe(1);
    }

    [Theory]
    [InlineData(1, 0, 0)]
    [InlineData(0, 1, 0)]
    [InlineData(0, 0, 1)]
    public async Task DeletingALineWithAPhotoATypeOrAGalleryItemIs422AndDeletesNothing(int photos, int types, int gallery)
    {
        var harness = new Harness();
        var line = Line();
        harness.Stored(line);
        harness.Lines.GetUsageAsync(line.Id, Arg.Any<CancellationToken>()).Returns(new ProductLineUsage(photos, types, gallery));

        var result = await harness.Delete.HandleAsync(line.Id, Token);

        result.Error.ShouldBe(SiteContentErrors.LineInUse);
        result.Error.Message.ShouldBe("This product line is in use. Hide it instead.");
        harness.Lines.DidNotReceive().Remove(Arg.Any<ProductLine>());
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task DeletingAnUnknownLineIs404AndLosingARaceTwiceIsBusy()
    {
        var harness = new Harness();
        var lost = new Harness();
        var line = Line();
        lost.Stored(line);
        lost.Unit.FailEverySaveWithConflict();

        var missing = await harness.Delete.HandleAsync(Guid.NewGuid(), Token);
        var busy = await lost.Delete.HandleAsync(line.Id, Token);

        missing.Error.ShouldBe(SiteContentErrors.LineNotFound);
        busy.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    // -- audit detail ---------------------------------------------------------------------------------------------------------------

    [Fact]
    public void AChangedEntryThatWouldBeTooLongLeavesOutThePairThatDoesNotFitAndKeepsTheRest()
    {
        var allFields = new[] { "title", "shortName", "number", "cardText", "description", "fabricText", "collarText", "cutText", "namesText", "logosText", "startsAtPrice", "minimumQuantity" };
        var change = new ProductLineChanges(allFields, new string('%', 60), new string('%', 59), new string('%', 20), new string('%', 19), 1m, 2m, 1, 2, null);

        var detail = ProductLineAuditDetail.Changed(change);

        detail.Length.ShouldBeLessThanOrEqualTo(AuditEntry.DetailMaxLength);
        detail.ShouldStartWith("fields=title,shortName,number,");
        detail.ShouldNotContain(";title=");
        detail.ShouldContain(";shortName=");
        detail.ShouldEndWith(";price=1.00>2.00;minimum=1>2");
    }

    [Fact]
    public void ADetailGuardsItsArguments()
    {
        Should.Throw<ArgumentNullException>(() => ProductLineAuditDetail.Named(null!));
        Should.Throw<ArgumentNullException>(() => ProductLineAuditDetail.Changed(null!));
        Should.Throw<ArgumentNullException>(() => ProductLineAuditDetail.Moved(null!, 1));
        Should.Throw<ArgumentNullException>(() => ProductLineListItemDto.From(null!, Substitute.For<IImageDelivery>()));
        Should.Throw<ArgumentNullException>(() => ProductLineDetailDto.From(null!, Substitute.For<IImageDelivery>()));
    }

    [Fact]
    public async Task EveryHandlerRejectsANullRequest()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Create.HandleAsync(null!, Token));
        await Should.ThrowAsync<ArgumentNullException>(() => harness.Update.HandleAsync(Guid.NewGuid(), null!, Token));
        await Should.ThrowAsync<ArgumentNullException>(() => harness.Move.HandleAsync(Guid.NewGuid(), null!, Token));
    }

    private sealed class PassingValidator : AbstractValidator<ProductLineRequest>;

    private sealed class Harness
    {
        public Harness(IValidator<ProductLineRequest>? validator = null)
        {
            Lines = Substitute.For<IProductLines>();
            Lines.FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<ProductLine?>(null));
            Lines.FindNeighbourAsync(Arg.Any<ProductLine>(), Arg.Any<bool>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<ProductLine?>(null));
            Lines.ShortNameTakenAsync(Arg.Any<string>(), Arg.Any<Guid?>(), Arg.Any<CancellationToken>()).Returns(false);
            Lines.GetKeysAsync(Arg.Any<CancellationToken>()).Returns(new HashSet<string>(StringComparer.OrdinalIgnoreCase));
            Lines.GetNextPositionAsync(Arg.Any<CancellationToken>()).Returns(7);
            Lines.GetUsageAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(new ProductLineUsage(0, 0, 0));
            Lines.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(call =>
                Task.FromResult<ProductLineDetailRow?>(Detail(StoredLine ?? Added.FirstOrDefault() ?? Line())));
            Lines.When(store => store.Add(Arg.Any<ProductLine>())).Do(call => Added.Add(call.Arg<ProductLine>()));
            SiteLock = Substitute.For<ISiteContentLock>();
            SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
            var time = Substitute.For<TimeProvider>();
            time.GetUtcNow().Returns(Now);
            var rules = validator ?? new ProductLineRequestValidator();
            var moveRules = new MoveProductLineRequestValidator();
            var delivery = Substitute.For<IImageDelivery>();
            List = new ListProductLinesHandler(Lines, delivery);
            Get = new GetProductLineHandler(Lines, delivery);
            Create = new CreateProductLineHandler(Lines, SiteLock, Audit, Unit, time, rules, delivery);
            Update = new UpdateProductLineHandler(Lines, SiteLock, Audit, Unit, rules, delivery);
            Move = new MoveProductLineHandler(Lines, SiteLock, Audit, Unit, moveRules);
            SetShown = new SetProductLineShownHandler(Lines, Audit, Unit);
            Delete = new DeleteProductLineHandler(Lines, SiteLock, Audit, Unit);
        }

        public IProductLines Lines { get; }

        public ISiteContentLock SiteLock { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public List<ProductLine> Added { get; } = [];

        public ProductLine? StoredLine { get; private set; }

        public ListProductLinesHandler List { get; }

        public GetProductLineHandler Get { get; }

        public CreateProductLineHandler Create { get; }

        public UpdateProductLineHandler Update { get; }

        public MoveProductLineHandler Move { get; }

        public SetProductLineShownHandler SetShown { get; }

        public DeleteProductLineHandler Delete { get; }

        public void Stored(ProductLine line)
        {
            StoredLine = line;
            Lines.FindAsync(line.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<ProductLine?>(line));
        }
    }
}
