using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Content;
using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Content;
using FluentValidation;
using FluentValidation.Results;
using NSubstitute;
using NSubstitute.Core;

namespace Csps.Application.UnitTests.Content;

/// <summary>
/// CONT-03, SEC-07, AUDIT-01, T-11-54: the testimonial handlers check the form first, take the site-content lock before they move or
/// add, write one audit entry per change that names the person and never the words, read again once when a save loses a race, and the
/// Home read returns the cached snapshot as it is.
/// </summary>
public sealed class TestimonialHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 9, 0, 0, TimeSpan.Zero);
    private static readonly byte[] Version = [0, 0, 0, 0, 0, 0, 0x1F, 0xA4];
    private static readonly string VersionText = RowVersions.ToText(Version);

    private static readonly TestimonialRequest Valid = new("Seventeen pieces, names and numbers perfect.", "Juan Dela Cruz", "Captain, Brgy. Sample Ballers", 5, true, null);

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static Testimonial Stored(string name = "Juan Dela Cruz", int position = 1, bool shown = true)
    {
        var testimonial = Testimonial.Create(Valid.ToValues() with { Name = name, IsShown = shown }, position, Now).Value;
        typeof(Testimonial).GetProperty(nameof(Testimonial.RowVersion))!.SetValue(testimonial, Version);
        return testimonial;
    }

    // A validator that lets everything through, to reach the domain's own refusal.
    private static IValidator<T> PermissiveValidator<T>()
    {
        var validator = Substitute.For<IValidator<T>>();
        validator.ValidateAsync(Arg.Any<ValidationContext<T>>(), Arg.Any<CancellationToken>()).Returns(new ValidationResult());
        validator.ValidateAsync(Arg.Any<T>(), Arg.Any<CancellationToken>()).Returns(new ValidationResult());
        return validator;
    }

    // -- list ------------------------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task TheListMapsEveryRowWithItsVersion()
    {
        var harness = new Harness();
        harness.Store.ListAsync(Arg.Any<CancellationToken>()).Returns([Stored("Ana", 1), Stored("Ben", 2, shown: false)]);

        var result = await harness.List.HandleAsync(Token);

        result.Value.Select(item => item.Name).ShouldBe(["Ana", "Ben"]);
        result.Value.Select(item => item.IsShown).ShouldBe([true, false]);
        result.Value[0].Version.ShouldBe(VersionText);
        result.Value[0].TeamOrRole.ShouldBe("Captain, Brgy. Sample Ballers");
        result.Value[0].Stars.ShouldBe(5);
        result.Value[1].Position.ShouldBe(2);
    }

    [Fact]
    public void MappingNullIsRefused() => Should.Throw<ArgumentNullException>(() => TestimonialDto.From(null!));

    // -- add -------------------------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task AddingTakesTheLockThenPutsItAtTheEndAndWritesOneAuditEntryWithTheNameOnly()
    {
        var harness = new Harness();

        var result = await harness.Create.HandleAsync(Valid, Token);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Position.ShouldBe(4);
        result.Value.IsShown.ShouldBeTrue();
        harness.Added.ShouldHaveSingleItem().Name.ShouldBe("Juan Dela Cruz");
        harness.Unit.Saves.ShouldBe(1);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.TestimonialAdded);
        entry.TargetType.ShouldBe("Testimonial");
        entry.Detail.ShouldBe("name=Juan Dela Cruz");
        entry.Detail.ShouldNotBeNull().ShouldNotContain("Seventeen");
        await harness.SiteLock.Received(1).TakeAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnInvalidFormIsRefusedBeforeAnyTransactionOrAudit()
    {
        var harness = new Harness();

        var result = await harness.Create.HandleAsync(TestimonialRequest.Empty, Token);

        result.Error.Code.ShouldBe(SiteContentErrors.InvalidCode);
        harness.Unit.Commits.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
        Should.Throw<ArgumentNullException>(() => harness.Create.HandleAsync(null!, Token));
    }

    [Fact]
    public async Task AddingStillAnswersTheDomainsOwnRefusalWhenTheFormRulesLetItThrough()
    {
        var harness = new Harness(PermissiveValidator<TestimonialRequest>());

        var result = await harness.Create.HandleAsync(TestimonialRequest.Empty, Token);

        result.Error.Code.ShouldBe(SiteSettings.InvalidCode);
        harness.Added.ShouldBeEmpty();
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AddingWhenTheLockIsBusyIsTheSharedBusyLineAndALostSaveIsReadAgainOnceThenBusy()
    {
        var busy = new Harness();
        busy.SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(_ => Task.FromException(new SiteContentBusyException()));
        var once = new Harness();
        once.Unit.FailFirstSaveWithConflict();
        var twice = new Harness();
        twice.Unit.FailEverySaveWithConflict();

        (await busy.Create.HandleAsync(Valid, Token)).Error.ShouldBe(AuthErrors.SessionBusy);
        (await once.Create.HandleAsync(Valid, Token)).IsSuccess.ShouldBeTrue();
        (await twice.Create.HandleAsync(Valid, Token)).Error.ShouldBe(AuthErrors.SessionBusy);
    }

    // -- edit ------------------------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task EditingAnUnknownTestimonialIs404AndAStaleVersionIs409AndAnInvalidFormIs400()
    {
        var harness = new Harness();
        var unknown = await harness.Update.HandleAsync(Guid.NewGuid(), Valid with { Version = VersionText }, Token);
        var stored = Stored();
        harness.Has(stored);

        var stale = await harness.Update.HandleAsync(stored.Id, Valid with { Version = Convert.ToBase64String(new byte[8]) }, Token);
        var invalid = await harness.Update.HandleAsync(stored.Id, Valid with { Quote = null, Version = VersionText }, Token);

        unknown.Error.ShouldBe(SiteContentErrors.TestimonialNotFound);
        unknown.Error.Message.ShouldBe("This testimonial wasn't found.");
        stale.Error.ShouldBe(EditErrors.Stale);
        invalid.Error.Code.ShouldBe(SiteContentErrors.InvalidCode);
        harness.Audit.Entries.ShouldBeEmpty();
        Should.Throw<ArgumentNullException>(() => harness.Update.HandleAsync(stored.Id, null!, Token));
    }

    [Fact]
    public async Task ALostSaveOnAnEditIsStaleAndNeverRetried()
    {
        var harness = new Harness();
        var stored = Stored();
        harness.Has(stored);
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Update.HandleAsync(stored.Id, Valid with { Stars = 3, Version = VersionText }, Token);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task AnEditThatChangesNothingSavesNothingAndWritesNoAudit()
    {
        var harness = new Harness();
        var stored = Stored();
        harness.Has(stored);

        var result = await harness.Update.HandleAsync(stored.Id, Valid with { Version = VersionText }, Token);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Version.ShouldBe(VersionText);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AnEditWritesChangedWithTheFieldNamesAndTheShortValuesAndNeverTheQuote()
    {
        var harness = new Harness();
        var stored = Stored();
        harness.Has(stored);

        var result = await harness.Update.HandleAsync(
            stored.Id,
            Valid with { Quote = "Different private words", Name = "Juan D.", Stars = 4, TeamOrRole = "Coach", Version = VersionText },
            Token);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Name.ShouldBe("Juan D.");
        harness.Unit.Saves.ShouldBe(1);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.TestimonialChanged);
        entry.TargetId.ShouldBe(stored.Id.ToString("D"));
        entry.Detail.ShouldBe("fields=quote,name,teamOrRole,stars;name=Juan Dela Cruz>Juan D.;stars=5>4");
        entry.Detail.ShouldNotBeNull().ShouldNotContain("Different");
        entry.Detail.ShouldNotContain("Coach");
    }

    [Fact]
    public async Task AFlipOfTheShownFlagWritesShownOrHiddenAlongsideTheChange()
    {
        var harness = new Harness();
        var stored = Stored();
        harness.Has(stored);

        await harness.Update.HandleAsync(stored.Id, Valid with { IsShown = false, Version = VersionText }, Token);
        harness.Audit.Entries.ShouldHaveSingleItem().Action.ShouldBe(AuditActions.TestimonialHidden);

        var second = new Harness();
        var hidden = Stored(shown: false);
        second.Has(hidden);
        await second.Update.HandleAsync(hidden.Id, Valid with { IsShown = true, Stars = 2, Version = VersionText }, Token);
        second.Audit.Entries.Select(entry => entry.Action).ShouldBe([AuditActions.TestimonialChanged, AuditActions.TestimonialShown]);
    }

    [Fact]
    public async Task AnEditStillAnswersTheDomainsOwnRefusalWhenTheFormRulesLetItThrough()
    {
        var harness = new Harness(PermissiveValidator<TestimonialRequest>());
        var stored = Stored();
        harness.Has(stored);

        var result = await harness.Update.HandleAsync(stored.Id, Valid with { Stars = 9, Version = VersionText }, Token);

        result.Error.Code.ShouldBe(SiteSettings.InvalidCode);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    // -- move ------------------------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task MovingTakesTheLockSwapsWithTheNeighbourAndWritesOneAuditEntry()
    {
        var harness = new Harness();
        var ben = Stored("Ben", 2);
        var ana = Stored("Ana", 1);
        harness.Has(ben);
        harness.Store.FindNeighbourAsync(ben, true, Arg.Any<CancellationToken>()).Returns(ana);

        var result = await harness.Move.HandleAsync(ben.Id, new MoveTestimonialRequest("UP"), Token);

        result.IsSuccess.ShouldBeTrue();
        ben.Position.ShouldBe(1);
        ana.Position.ShouldBe(2);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.TestimonialMoved);
        entry.Detail.ShouldBe("name=Ben;position=2>1");
        await harness.SiteLock.Received(1).TakeAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task MovingDownAsksForTheNextNeighbour()
    {
        var harness = new Harness();
        var ana = Stored("Ana", 1);
        var ben = Stored("Ben", 2);
        harness.Has(ana);
        harness.Store.FindNeighbourAsync(ana, false, Arg.Any<CancellationToken>()).Returns(ben);

        var result = await harness.Move.HandleAsync(ana.Id, new MoveTestimonialRequest("down"), Token);

        result.IsSuccess.ShouldBeTrue();
        ana.Position.ShouldBe(2);
        harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe("name=Ana;position=1>2");
    }

    [Fact]
    public async Task MovingAtTheEndOfTheOrderSucceedsAndChangesAndRecordsNothing()
    {
        var harness = new Harness();
        var ana = Stored("Ana", 1);
        harness.Has(ana);

        var result = await harness.Move.HandleAsync(ana.Id, new MoveTestimonialRequest("up"), Token);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task MovingRefusesABadDirectionAnUnknownTestimonialAndABusyLock()
    {
        var harness = new Harness();
        var busy = new Harness();
        var ana = Stored("Ana", 1);
        busy.Has(ana);
        busy.SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(_ => Task.FromException(new SiteContentBusyException()));
        var lost = new Harness();
        var lostAna = Stored("Ana", 1);
        lost.Has(lostAna);
        lost.Store.FindNeighbourAsync(lostAna, Arg.Any<bool>(), Arg.Any<CancellationToken>()).Returns(Stored("Ben", 2));
        lost.Unit.FailEverySaveWithConflict();

        (await harness.Move.HandleAsync(Guid.NewGuid(), new MoveTestimonialRequest("sideways"), Token)).Error.Code.ShouldBe(SiteContentErrors.InvalidCode);
        (await harness.Move.HandleAsync(Guid.NewGuid(), new MoveTestimonialRequest("up"), Token)).Error.ShouldBe(SiteContentErrors.TestimonialNotFound);
        (await busy.Move.HandleAsync(ana.Id, new MoveTestimonialRequest("up"), Token)).Error.ShouldBe(AuthErrors.SessionBusy);
        (await lost.Move.HandleAsync(lostAna.Id, new MoveTestimonialRequest("up"), Token)).Error.ShouldBe(AuthErrors.SessionBusy);
        Should.Throw<ArgumentNullException>(() => harness.Move.HandleAsync(Guid.NewGuid(), null!, Token));
    }

    // -- hide and show ---------------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task HidingAndShowingFlipTheFlagAndEachWritesItsOwnEntryWithTheName()
    {
        var harness = new Harness();
        var ana = Stored("Ana");
        harness.Has(ana);

        (await harness.SetShown.HandleAsync(ana.Id, shown: false, Token)).IsSuccess.ShouldBeTrue();
        (await harness.SetShown.HandleAsync(ana.Id, shown: true, Token)).IsSuccess.ShouldBeTrue();

        ana.IsShown.ShouldBeTrue();
        harness.Audit.Entries.Select(entry => entry.Action).ShouldBe([AuditActions.TestimonialHidden, AuditActions.TestimonialShown]);
        harness.Audit.Entries.ShouldAllBe(entry => entry.Detail == "name=Ana" && entry.TargetId == ana.Id.ToString("D"));
    }

    [Fact]
    public async Task HidingAHiddenOrShowingAShownTestimonialChangesAndRecordsNothing()
    {
        var harness = new Harness();
        var hidden = Stored("Ana", shown: false);
        var shown = Stored("Ben");
        harness.Has(hidden);
        harness.Has(shown);

        (await harness.SetShown.HandleAsync(hidden.Id, shown: false, Token)).IsSuccess.ShouldBeTrue();
        (await harness.SetShown.HandleAsync(shown.Id, shown: true, Token)).IsSuccess.ShouldBeTrue();

        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task HidingAnUnknownTestimonialIs404AndALostSaveTwiceIsBusy()
    {
        var harness = new Harness();
        var lost = new Harness();

        // A store that reads again hands out a row in its stored state, not the one an earlier attempt changed.
        lost.Store.FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<Testimonial?>(Stored("Ana")));
        lost.Unit.FailEverySaveWithConflict();

        (await harness.SetShown.HandleAsync(Guid.NewGuid(), shown: false, Token)).Error.ShouldBe(SiteContentErrors.TestimonialNotFound);
        (await lost.SetShown.HandleAsync(Guid.NewGuid(), shown: false, Token)).Error.ShouldBe(AuthErrors.SessionBusy);
    }

    // -- delete ----------------------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task DeletingWritesTheEntryWithTheNameAndRemovesTheRow()
    {
        var harness = new Harness();
        var juan = Stored();
        harness.Has(juan);

        var result = await harness.Delete.HandleAsync(juan.Id, Token);

        result.IsSuccess.ShouldBeTrue();
        harness.Removed.ShouldHaveSingleItem().ShouldBeSameAs(juan);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.TestimonialDeleted);
        entry.Detail.ShouldBe("name=Juan Dela Cruz");
    }

    [Fact]
    public async Task DeletingAnUnknownTestimonialIs404AndALostSaveTwiceIsBusy()
    {
        var harness = new Harness();
        var lost = new Harness();
        var juan = Stored();
        lost.Has(juan);
        lost.Unit.FailEverySaveWithConflict();

        (await harness.Delete.HandleAsync(Guid.NewGuid(), Token)).Error.ShouldBe(SiteContentErrors.TestimonialNotFound);
        (await lost.Delete.HandleAsync(juan.Id, Token)).Error.ShouldBe(AuthErrors.SessionBusy);
    }

    // -- audit detail ---------------------------------------------------------------------------------------------------------------

    [Fact]
    public void TheAuditDetailBuildersRefuseNullAndNameTheTargetType()
    {
        TestimonialAuditDetail.TargetType.ShouldBe("Testimonial");
        Should.Throw<ArgumentNullException>(() => TestimonialAuditDetail.Named(null!));
        Should.Throw<ArgumentNullException>(() => TestimonialAuditDetail.Changed(null!));
        Should.Throw<ArgumentNullException>(() => TestimonialAuditDetail.Moved(null!, 1));
    }

    [Fact]
    public void AQuoteOnlyChangeIsJustTheFieldName() =>
        TestimonialAuditDetail.Changed(new TestimonialChanges(["quote"], "Ana", "Ana", 5, 5, null)).ShouldBe("fields=quote");

    // -- public Home read ------------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task TheHomeReadReturnsTheCachedSnapshotUnchangedAndPassesTheToken()
    {
        var snapshot = new PublicHomeSnapshot(
            new PublicHomeDto([], 0, [], [], null),
            new PublicJsonSnapshot("{}", "\"abc\"", new DateTimeOffset(2026, 11, 11, 0, 0, 0, TimeSpan.Zero)));
        var reader = Reader(_ => ValueTask.FromResult(snapshot));
        using var cancellation = new CancellationTokenSource();

        var result = await new GetPublicHomeHandler(reader).HandleAsync(cancellation.Token);

        result.Value.ShouldBeSameAs(snapshot);
        GetPublicHomeHandler.TestimonialLimit.ShouldBe(3);
        await reader.Received(1).GetHomeAsync(cancellation.Token);
    }

    [Fact]
    public async Task AHomeReaderFailurePropagates()
    {
        var reader = Reader(_ => ValueTask.FromException<PublicHomeSnapshot>(new InvalidOperationException("down")));

        await Should.ThrowAsync<InvalidOperationException>(async () => await new GetPublicHomeHandler(reader).HandleAsync(Token));
    }

    private static IPublicContentReader Reader(Func<CallInfo, ValueTask<PublicHomeSnapshot>> result)
    {
        var reader = Substitute.For<IPublicContentReader>();
#pragma warning disable CA2012 // NSubstitute only records the call here; the arranged ValueTask is consumed once, by the handler.
        reader.GetHomeAsync(Arg.Any<CancellationToken>()).Returns(result);
#pragma warning restore CA2012
        return reader;
    }

    // -- the card photo --------------------------------------------------------------------------------------------------------------

    [Fact]
    public void TheCardPhotoUsesTheCardSizesAndIsNullWhenTheDeliveryHasNoAddress()
    {
        var photo = ProductLinePhoto.Create(Guid.NewGuid(), ProductLinePhotoSlot.Main, new LinePhotoFile("csps/content/lines/x/abc", 800, 1000, 5000, "jpg"), Now);
        var delivery = Substitute.For<IImageDelivery>();
        delivery.ForLinePhoto(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<int>()).Returns(
            new LinePhotoUrls(new ImageSource("card.jpg", "card.jpg 320w"), new ImageSource("large.jpg", "large.jpg 640w"), new ImageSource("small.jpg", "small.jpg 200w"), "thumb"));
        var empty = Substitute.For<IImageDelivery>();
        empty.ForLinePhoto(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<int>()).Returns(
            new LinePhotoUrls(new ImageSource(string.Empty, string.Empty), new ImageSource(string.Empty, string.Empty), new ImageSource(string.Empty, string.Empty), string.Empty));

        var card = ProductLinePhotoMapper.ToPublicCard(photo, delivery);

        card.ShouldNotBeNull().Src.ShouldBe("card.jpg");
        card.SrcSet.ShouldBe("card.jpg 320w");
        card.Width.ShouldBe(800);
        ProductLinePhotoMapper.ToPublicCard(photo, empty).ShouldBeNull();
        Should.Throw<ArgumentNullException>(() => ProductLinePhotoMapper.ToPublicCard(null!, delivery));
        Should.Throw<ArgumentNullException>(() => ProductLinePhotoMapper.ToPublicCard(photo, null!));
    }

    private sealed class Harness
    {
        public Harness(IValidator<TestimonialRequest>? validator = null)
        {
            Store = Substitute.For<ITestimonials>();
            Store.FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<Testimonial?>(null));
            Store.FindNeighbourAsync(Arg.Any<Testimonial>(), Arg.Any<bool>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<Testimonial?>(null));
            Store.GetNextPositionAsync(Arg.Any<CancellationToken>()).Returns(4);
            Store.When(store => store.Add(Arg.Any<Testimonial>())).Do(call => Added.Add(call.Arg<Testimonial>()));
            Store.When(store => store.Remove(Arg.Any<Testimonial>())).Do(call => Removed.Add(call.Arg<Testimonial>()));
            SiteLock = Substitute.For<ISiteContentLock>();
            SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
            var time = Substitute.For<TimeProvider>();
            time.GetUtcNow().Returns(Now);
            var rules = validator ?? new TestimonialRequestValidator();
            List = new ListTestimonialsHandler(Store);
            Create = new CreateTestimonialHandler(Store, SiteLock, Audit, Unit, time, rules);
            Update = new UpdateTestimonialHandler(Store, Audit, Unit, rules);
            Move = new MoveTestimonialHandler(Store, SiteLock, Audit, Unit, new MoveTestimonialRequestValidator());
            SetShown = new SetTestimonialShownHandler(Store, Audit, Unit);
            Delete = new DeleteTestimonialHandler(Store, Audit, Unit);
        }

        public ITestimonials Store { get; }

        public ISiteContentLock SiteLock { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public List<Testimonial> Added { get; } = [];

        public List<Testimonial> Removed { get; } = [];

        public ListTestimonialsHandler List { get; }

        public CreateTestimonialHandler Create { get; }

        public UpdateTestimonialHandler Update { get; }

        public MoveTestimonialHandler Move { get; }

        public SetTestimonialShownHandler SetShown { get; }

        public DeleteTestimonialHandler Delete { get; }

        public void Has(Testimonial testimonial) =>
            Store.FindAsync(testimonial.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<Testimonial?>(testimonial));
    }
}
