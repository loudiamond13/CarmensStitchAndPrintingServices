using System.Reflection;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Content;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Content;

/// <summary>
/// CONT-04, SEC-07, AUDIT-01, T-11-31, T-11-32: the closure handlers take the site-content lock before they decide, answer the shared
/// busy line when the lock cannot be had, read again once when a save loses a race, and write one audit entry per change.
/// </summary>
public sealed class ShopClosureHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 12, 1, 2, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 12, 1);
    private static readonly byte[] RowVersion = [0, 0, 0, 0, 0, 0, 0x1F, 0xA4];

    [Fact]
    public async Task AddingTakesTheLockBeforeTheOverlapCheckAndWritesOneAuditEntry()
    {
        var harness = new Harness();

        var result = await harness.Create.HandleAsync(new ShopClosureRequest("2026-12-24", "2026-12-26", "Christmas", null), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        Received.InOrder(() =>
        {
            harness.SiteLock.TakeAsync(Arg.Any<CancellationToken>());
            harness.Store.FindOverlappingClosureAsync(new DateOnly(2026, 12, 24), new DateOnly(2026, 12, 26), null, Arg.Any<CancellationToken>());
            harness.Store.AddClosure(Arg.Any<ShopClosure>());
        });
        harness.Unit.Saves.ShouldBe(1);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.ShopClosureAdded);
        entry.TargetType.ShouldBe("ShopClosure");
        entry.Detail.ShouldBe("first=2026-12-24;last=2026-12-26;fields=note");
        result.Value.Note.ShouldBe("Christmas");
    }

    [Fact]
    public async Task AnOverlapIs400OnFirstDayNamingTheSharedDayAndStoresNothing()
    {
        var harness = new Harness();
        harness.Store.FindOverlappingClosureAsync(Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<Guid?>(), Arg.Any<CancellationToken>())
            .Returns(Closure("2026-12-24", "2026-12-26"));

        var result = await harness.Create.HandleAsync(new ShopClosureRequest("2026-12-25", null, null, null), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors!["firstDay"].ShouldBe(["There's already a closure on Dec 25, 2026."]);
        harness.Store.DidNotReceive().AddClosure(Arg.Any<ShopClosure>());
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AFormTheValidatorRefusesNeverTakesTheLock()
    {
        var harness = new Harness();

        var result = await harness.Create.HandleAsync(ShopClosureRequest.Empty, TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe(SiteContentErrors.InvalidCode);
        result.Error.FieldErrors!["firstDay"].ShouldBe(["Enter the first day."]);
        _ = harness.SiteLock.DidNotReceive().TakeAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddingWhenTheLockIsBusyAnswersTheSharedBusyLine()
    {
        var harness = new Harness();
        harness.SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(_ => Task.FromException(new SiteContentBusyException()));

        var result = await harness.Create.HandleAsync(new ShopClosureRequest("2026-12-24", null, null, null), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
        result.Error.Message.ShouldBe("Something changed at the same time. Try again.");
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AddingThatLosesARaceTwiceIsBusyAndOnceIsRetried()
    {
        var once = new Harness();
        once.Unit.FailFirstSaveWithConflict();
        var twice = new Harness();
        twice.Unit.FailEverySaveWithConflict();

        var recovered = await once.Create.HandleAsync(new ShopClosureRequest("2026-12-24", null, null, null), TestContext.Current.CancellationToken);
        var lost = await twice.Create.HandleAsync(new ShopClosureRequest("2026-12-24", null, null, null), TestContext.Current.CancellationToken);

        recovered.IsSuccess.ShouldBeTrue();
        lost.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    [Fact]
    public async Task ADayTheDomainRefusesAfterTheValidatorIs400()
    {
        var harness = new Harness(validator: new PassingValidator());

        var result = await harness.Create.HandleAsync(new ShopClosureRequest("2026-11-01", null, null, null), TestContext.Current.CancellationToken);

        result.Error.FieldErrors!["firstDay"].ShouldBe(["Pick today or a later date."]);
        harness.Store.DidNotReceive().AddClosure(Arg.Any<ShopClosure>());
    }

    [Fact]
    public async Task EditingChangesTheDaysWritesOneAuditEntryAndReturnsTheNewDays()
    {
        var harness = new Harness();
        var stored = Closure("2026-12-24", "2026-12-26", "Christmas");
        harness.Store.FindClosureAsync(stored.Id, Arg.Any<CancellationToken>()).Returns(stored);

        var result = await harness.Update.HandleAsync(stored.Id, Edit("2026-12-24", "2026-12-27", "Christmas"), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.LastDay.ShouldBe("2026-12-27");
        harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe("first=2026-12-24;last=2026-12-26>2026-12-27");
        harness.Audit.Entries[0].Action.ShouldBe(AuditActions.ShopClosureChanged);
        await harness.Store.Received(1).FindOverlappingClosureAsync(new DateOnly(2026, 12, 24), new DateOnly(2026, 12, 27), stored.Id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EditingWithNoChangeSavesNothingAndWritesNoAuditEntry()
    {
        var harness = new Harness();
        var stored = Closure("2026-12-24", "2026-12-26", "Christmas");
        harness.Store.FindClosureAsync(stored.Id, Arg.Any<CancellationToken>()).Returns(stored);

        var result = await harness.Update.HandleAsync(stored.Id, Edit("2026-12-24", "2026-12-26", "Christmas"), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task EditingAMissingClosureIs404()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(Guid.NewGuid(), Edit("2026-12-24", null, null), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ShopClosureErrors.NotFound);
    }

    [Fact]
    public async Task EditingWithAStaleVersionIs409AndChangesNothing()
    {
        var harness = new Harness();
        var stored = Closure("2026-12-24", "2026-12-26", "Christmas");
        harness.Store.FindClosureAsync(stored.Id, Arg.Any<CancellationToken>()).Returns(stored);
        var stale = Edit("2026-12-25", null, null) with { Version = RowVersions.ToText([0, 0, 0, 0, 0, 0, 0, 9]) };

        var result = await harness.Update.HandleAsync(stored.Id, stale, TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe(EditErrors.StaleCode);
        stored.FirstDay.ShouldBe(new DateOnly(2026, 12, 24));
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task EditingIntoAnotherClosureIs400NamingTheLaterOfTheTwoFirstDays()
    {
        var harness = new Harness();
        var stored = Closure("2026-12-30", "2027-01-01", null);
        harness.Store.FindClosureAsync(stored.Id, Arg.Any<CancellationToken>()).Returns(stored);
        harness.Store.FindOverlappingClosureAsync(Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<Guid?>(), Arg.Any<CancellationToken>())
            .Returns(Closure("2026-12-24", "2026-12-31"));

        var result = await harness.Update.HandleAsync(stored.Id, Edit("2026-12-26", "2027-01-01", null), TestContext.Current.CancellationToken);

        result.Error.FieldErrors!["firstDay"].ShouldBe(["There's already a closure on Dec 26, 2026."]);
        stored.FirstDay.ShouldBe(new DateOnly(2026, 12, 30), "a refused edit leaves the tracked row untouched");
    }

    [Fact]
    public async Task EditingAFirstDayIntoThePastTheDomainRefusesIs400()
    {
        var harness = new Harness();
        var stored = Closure("2026-12-24", "2026-12-26", null);
        harness.Store.FindClosureAsync(stored.Id, Arg.Any<CancellationToken>()).Returns(stored);

        var result = await harness.Update.HandleAsync(stored.Id, Edit("2026-11-30", "2026-12-26", null), TestContext.Current.CancellationToken);

        result.Error.FieldErrors!["firstDay"].ShouldBe(["Pick today or a later date."]);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task EditingAFormTheValidatorRefusesIs400()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(Guid.NewGuid(), new ShopClosureRequest("2026-12-24", null, null, null), TestContext.Current.CancellationToken);

        result.Error.FieldErrors!["version"].ShouldBe([RowVersions.InvalidMessage]);
    }

    [Fact]
    public async Task EditingThatLosesARaceOnSaveIs409StaleAndIsNotRetried()
    {
        var harness = new Harness();
        var stored = Closure("2026-12-24", "2026-12-26", null);
        harness.Store.FindClosureAsync(stored.Id, Arg.Any<CancellationToken>()).Returns(stored);
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Update.HandleAsync(stored.Id, Edit("2026-12-24", "2026-12-27", null), TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe(EditErrors.StaleCode);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task EditingWhenTheLockIsBusyAnswersTheSharedBusyLine()
    {
        var harness = new Harness();
        harness.SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(_ => Task.FromException(new SiteContentBusyException()));

        var result = await harness.Update.HandleAsync(Guid.NewGuid(), Edit("2026-12-24", null, null), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    [Fact]
    public async Task DeletingWritesOneAuditEntryWithTheDaysAndRemovesTheRow()
    {
        var harness = new Harness();
        var stored = Closure("2026-12-24", "2026-12-26", "Private reason");
        harness.Store.FindClosureAsync(stored.Id, Arg.Any<CancellationToken>()).Returns(stored);

        var result = await harness.Delete.HandleAsync(stored.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Store.Received(1).RemoveClosure(stored);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.ShopClosureDeleted);
        entry.Detail.ShouldBe("first=2026-12-24;last=2026-12-26");
    }

    [Fact]
    public async Task DeletingAMissingClosureIs404()
    {
        var harness = new Harness();

        var result = await harness.Delete.HandleAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ShopClosureErrors.NotFound);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task DeletingThatLosesARaceTwiceIs409Busy()
    {
        var harness = new Harness();
        var stored = Closure("2026-12-24", "2026-12-26", null);
        harness.Store.FindClosureAsync(stored.Id, Arg.Any<CancellationToken>()).Returns(stored);
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Delete.HandleAsync(stored.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    [Fact]
    public async Task TheListReadsFromTheBusinessTodayAndMapsEachClosureWithItsVersion()
    {
        var harness = new Harness();
        var stored = Closure("2026-12-24", "2026-12-26", "Christmas");
        harness.Store.GetUpcomingClosuresAsync(Today, Arg.Any<CancellationToken>()).Returns(Task.FromResult<IReadOnlyList<ShopClosure>>([stored]));

        var result = await harness.List.HandleAsync(TestContext.Current.CancellationToken);

        var dto = result.Value.ShouldHaveSingleItem();
        dto.ShouldBe(new ShopClosureDto(stored.Id, "2026-12-24", "2026-12-26", "Christmas", RowVersions.ToText(RowVersion)));
    }

    [Fact]
    public async Task ANullRequestIsAProgrammingError()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Create.HandleAsync(null!, TestContext.Current.CancellationToken));
        await Should.ThrowAsync<ArgumentNullException>(() => harness.Update.HandleAsync(Guid.NewGuid(), null!, TestContext.Current.CancellationToken));
    }

    private static ShopClosureRequest Edit(string first, string? last, string? note) => new(first, last, note, RowVersions.ToText(RowVersion));

    private static ShopClosure Closure(string first, string last, string? note = null)
    {
        var closure = ShopClosure.Create(
            DateOnly.ParseExact(first, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture),
            DateOnly.ParseExact(last, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture),
            note,
            DateOnly.MinValue,
            Now).Value;
        typeof(ShopClosure).GetProperty(nameof(ShopClosure.RowVersion), BindingFlags.Public | BindingFlags.Instance)!.SetValue(closure, RowVersion);
        return closure;
    }

    private sealed class PassingValidator : FluentValidation.IValidator<ShopClosureRequest>
    {
        public FluentValidation.Results.ValidationResult Validate(ShopClosureRequest instance) => new();

        public Task<FluentValidation.Results.ValidationResult> ValidateAsync(ShopClosureRequest instance, CancellationToken cancellation = default) =>
            Task.FromResult(new FluentValidation.Results.ValidationResult());

        public FluentValidation.Results.ValidationResult Validate(FluentValidation.IValidationContext context) => new();

        public Task<FluentValidation.Results.ValidationResult> ValidateAsync(FluentValidation.IValidationContext context, CancellationToken cancellation = default) =>
            Task.FromResult(new FluentValidation.Results.ValidationResult());

        public FluentValidation.IValidatorDescriptor CreateDescriptor() => throw new NotSupportedException();

        public bool CanValidateInstancesOfType(Type type) => true;
    }

    private sealed class Harness
    {
        public Harness(FluentValidation.IValidator<ShopClosureRequest>? validator = null)
        {
            Store = Substitute.For<ISiteContentStore>();
            Store.FindOverlappingClosureAsync(Arg.Any<DateOnly>(), Arg.Any<DateOnly>(), Arg.Any<Guid?>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<ShopClosure?>(null));
            Store.FindClosureAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<ShopClosure?>(null));
            SiteLock = Substitute.For<ISiteContentLock>();
            SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
            var calendar = Substitute.For<IBusinessCalendar>();
            calendar.GetClockAsync(Arg.Any<CancellationToken>()).Returns(new BusinessClock(TimeZoneInfo.Utc, ZoneSource.Stored, Now));
            var time = Substitute.For<TimeProvider>();
            time.GetUtcNow().Returns(Now);
            var rules = validator ?? new ShopClosureRequestValidator();
            Create = new CreateShopClosureHandler(Store, SiteLock, Audit, Unit, calendar, time, rules);
            Update = new UpdateShopClosureHandler(Store, SiteLock, Audit, Unit, calendar, rules);
            Delete = new DeleteShopClosureHandler(Store, Audit, Unit);
            List = new ListShopClosuresHandler(Store, calendar);
        }

        public ISiteContentStore Store { get; }

        public ISiteContentLock SiteLock { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public CreateShopClosureHandler Create { get; }

        public UpdateShopClosureHandler Update { get; }

        public DeleteShopClosureHandler Delete { get; }

        public ListShopClosuresHandler List { get; }
    }
}
