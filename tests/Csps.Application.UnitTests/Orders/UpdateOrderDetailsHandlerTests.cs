using System.Reflection;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Content;
using Csps.Domain.Orders;
using Csps.Domain.Time;
using FluentValidation;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace Csps.Application.UnitTests.Orders;

/// <summary>ORD-05, ORD-08, D-22, D-25, SEC-07: the handler checks the form, finds the order, compares the version and saves once; an unchanged form saves nothing.</summary>
public sealed class UpdateOrderDetailsHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly byte[] StoredVersion = [0, 0, 0, 0, 0, 0, 31, 164];
    private static readonly string StoredVersionText = Convert.ToBase64String(StoredVersion);
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid Basketball = ProductLineSeed.All.Single(entry => entry.Key == "basketball").Id;
    private static readonly Guid Volleyball = ProductLineSeed.All.Single(entry => entry.Key == "volleyball").Id;

    [Fact]
    public async Task WithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AMalformedVersionIsA400OnVersionAndTheOrderIsNotLookedUp()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { Version = "not a version" }, TestContext.Current.CancellationToken);

        Fields(result).Keys.ShouldBe(["version"]);
        Fields(result)["version"].ShouldBe(["Reload the form and try again."]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnEmptyFormListsEveryRequiredFieldIncludingTheVersion()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, UpdateOrderDetailsRequest.Empty, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["contactNumber", "customerName", "dueDate", "orderDate", "version"]);
        result.Error.Code.ShouldBe("orders.invalid-request");
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task AnUnknownOrderIsA404AndNothingIsSaved()
    {
        var harness = new Harness(found: false);

        var result = await harness.Handler.HandleAsync(Guid.NewGuid(), Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
        harness.Unit.Saves.ShouldBe(0);
        await harness.Reader.DidNotReceiveWithAnyArgs().GetDetailAsync(default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task ADifferentVersionIsStaleAndNothingIsChangedOrSaved()
    {
        var harness = new Harness();
        var other = Convert.ToBase64String([0, 0, 0, 0, 0, 0, 31, 165]);

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { Version = other, CustomerName = "Maria Santos" }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        result.Error.Kind.ShouldBe(ErrorKind.Conflict);
        harness.Order.CustomerName.ShouldBe("Juan Dela Cruz");
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ALostRaceAtSaveTimeIsStaleAndIsNotRetried()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { CustomerName = "Maria Santos" }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(1);
        await harness.Orders.Received(1).FindAsync(harness.Order.Id, false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AFormWithNoChangeIsA200ThatSavesNothing()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Unit.Commits.ShouldBe(1);
        await harness.Reader.Received(1).GetDetailAsync(harness.Order.Id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ARealChangeSavesOnceInOneTransactionWithTheClockInstantAndReadsTheOrderBack()
    {
        var harness = new Harness();
        var editVersion = harness.Order.EditVersion;

        var result = await harness.Handler.HandleAsync(
            harness.Order.Id,
            Valid() with { CustomerName = "  Maria Santos ", DueDate = "2026-11-30" },
            TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Order.CustomerName.ShouldBe("Maria Santos");
        harness.Order.DueDate.ShouldBe(new DateOnly(2026, 11, 30));
        harness.Order.EditVersion.ShouldNotBe(editVersion);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        await harness.Orders.Received(1).FindAsync(harness.Order.Id, false, Arg.Any<CancellationToken>());
        await harness.Reader.Received(1).GetDetailAsync(harness.Order.Id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnyStaffMemberMayEditWithNoOwnerCheck()
    {
        var harness = new Harness();
        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { Notes = "Call first" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Order.Notes.ShouldBe("Call first");
    }

    [Fact]
    public async Task ADomainRefusalAfterTheFormPassedSavesNothing()
    {
        var harness = new Harness(validator: new PassingValidator());

        var result = await harness.Handler.HandleAsync(
            harness.Order.Id,
            Valid() with { CustomerName = " " },
            TestContext.Current.CancellationToken);

        Fields(result)["customerName"].ShouldBe(["Enter the customer's name."]);
        harness.Unit.Saves.ShouldBe(0);
        harness.Order.CustomerName.ShouldBe("Juan Dela Cruz");
    }

    [Fact]
    public async Task AnOrderTheReaderCannotFindAfterTheSaveIsA404()
    {
        var harness = new Harness();
        harness.Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(null));

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { Notes = "x" }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
    }

    [Fact]
    public async Task ANullRequestIsAProgrammingError()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Handler.HandleAsync(harness.Order.Id, null!, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task ARealChangeRecordsOneChangedEntryBeforeTheSaveWithNoCustomerText()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(
            harness.Order.Id,
            Valid() with { CustomerName = "Private Name", Notes = "Private note", DueDate = "2026-11-18" },
            TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.ShouldBe(new AuditCall(
            AuditActions.OrderChanged,
            "Order",
            harness.Order.Id.ToString("D"),
            "dueDate=2026-11-11>2026-11-18;fields=customerName,notes",
            Independent: false));
        entry.SavesSoFar.ShouldBe(0);
        harness.Unit.Saves.ShouldBe(1);
        entry.Call.Detail.ShouldNotBeNull().ShouldNotContain("Private", Case.Insensitive);
    }

    [Fact]
    public async Task AFormWithNoChangeRecordsNothing()
    {
        var harness = new Harness();

        (await harness.Handler.HandleAsync(harness.Order.Id, Valid(), TestContext.Current.CancellationToken)).IsSuccess.ShouldBeTrue();

        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AStaleVersionARefusedFormAndAMissingOrderRecordNothing()
    {
        var stale = new Harness();
        await stale.Handler.HandleAsync(stale.Order.Id, Valid() with { Version = Convert.ToBase64String([0, 0, 0, 0, 0, 0, 0, 1]), Notes = "x" }, TestContext.Current.CancellationToken);
        var refused = new Harness(validator: new PassingValidator());
        await refused.Handler.HandleAsync(refused.Order.Id, Valid() with { CustomerName = " " }, TestContext.Current.CancellationToken);
        var missing = new Harness(found: false);
        await missing.Handler.HandleAsync(Guid.NewGuid(), Valid() with { Notes = "x" }, TestContext.Current.CancellationToken);

        stale.Audit.Entries.ShouldBeEmpty();
        refused.Audit.Entries.ShouldBeEmpty();
        missing.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AFormWithoutTheBlockTakesNoLockAndTouchesNoPublicSetting()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { Notes = "x" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.SiteLock.DidNotReceiveWithAnyArgs().TakeAsync(TestContext.Current.CancellationToken);
        harness.Order.HasCustomerConsent.ShouldBeFalse();
        harness.Added.ShouldBeEmpty();
        harness.Audit.Entries.Select(entry => entry.Call.Action).ShouldBe([AuditActions.OrderChanged]);
    }

    [Fact]
    public async Task TheBlockAndTheDetailsSaveTogetherInOneSaveAfterTheLock()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { Notes = "x", PublicWebsite = new OrderPublicWebsiteFields(true, true, null, null) }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Order.Notes.ShouldBe("x");
        harness.Order.PublicConsentById.ShouldBe(CallerId);
        harness.Order.PublicConsentAtUtc.ShouldBe(Now);
        harness.Order.IsShownOnWebsite.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        harness.Added.ShouldHaveSingleItem().OrderId.ShouldBe(harness.Order.Id);
        harness.Audit.Entries.Select(entry => entry.Call.Action).ShouldBe([AuditActions.OrderChanged, AuditActions.OrderPublicConsentRecorded, AuditActions.OrderShownOnWebsite]);
        harness.Audit.Entries.ShouldAllBe(entry => entry.SavesSoFar == 0);
        Received.InOrder(() =>
        {
            harness.SiteLock.TakeAsync(Arg.Any<CancellationToken>());
            harness.Orders.FindAsync(Arg.Any<Guid>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
        });
    }

    [Fact]
    public async Task ABlockThatChangesOnlyThePublicSettingsStillSavesAndWritesNoChangedEntry()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { PublicWebsite = new OrderPublicWebsiteFields(true, false, Volleyball, null) }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(1);
        harness.Order.PublicProductLineId.ShouldBe(Volleyball);
        harness.Audit.Entries.Select(entry => entry.Call.Action).ShouldBe([AuditActions.OrderPublicConsentRecorded, AuditActions.OrderPublicDetailsChanged]);
    }

    [Fact]
    public async Task AnUnchangedFormAndAnUnchangedBlockSaveNothingAndKeepTheVersion()
    {
        var harness = new Harness();
        harness.Order.SetPublicSettings(new OrderPublicSettings(true, true, null, null), CallerId, Basketball, Now).IsSuccess.ShouldBeTrue();
        var editVersion = harness.Order.EditVersion;

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { PublicWebsite = new OrderPublicWebsiteFields(true, true, null, null) }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Order.EditVersion.ShouldBe(editVersion);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Added.ShouldBeEmpty();
    }

    [Fact]
    public async Task ABlockThatTakesAShownOrderOffRemovesItsGalleryEntry()
    {
        var harness = new Harness();
        harness.Order.SetPublicSettings(new OrderPublicSettings(true, true, null, null), CallerId, Basketball, Now).IsSuccess.ShouldBeTrue();
        var entry = GalleryEntry.ForOrder(harness.Order.Id, 0, Now);
        harness.Gallery.FindForOrderAsync(harness.Order.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<GalleryEntry?>(entry));

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { PublicWebsite = new OrderPublicWebsiteFields(false, false, null, null) }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Gallery.Received(1).Remove(entry);
        harness.Audit.Entries.Select(row => row.Call.Action).ShouldBe([AuditActions.OrderPublicConsentRemoved, AuditActions.OrderTakenOffWebsite]);
    }

    [Fact]
    public async Task ARefusedBlockIsA400OnThePrefixedFieldAndTheDetailsAreNotSaved()
    {
        var noOk = new Harness();
        var noName = new Harness();
        noName.Order.UpdateDetails(new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", "juan.dc@example.com", null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null), Now).IsSuccess.ShouldBeTrue();

        var first = await noOk.Handler.HandleAsync(noOk.Order.Id, Valid() with { Notes = "x", PublicWebsite = new OrderPublicWebsiteFields(false, true, null, null) }, TestContext.Current.CancellationToken);
        var second = await noName.Handler.HandleAsync(noName.Order.Id, Valid() with { TeamName = null, Notes = "x", PublicWebsite = new OrderPublicWebsiteFields(true, true, null, null) }, TestContext.Current.CancellationToken);

        Fields(first).Keys.ShouldBe(["publicWebsite.showOnWebsite"]);
        Fields(second).Keys.ShouldBe(["publicWebsite.publicName"]);
        Fields(second)["publicWebsite.publicName"].ShouldBe(["This order has no team name. Enter the name to show."]);
        noOk.Unit.Saves.ShouldBe(0);
        noName.Unit.Saves.ShouldBe(0);
        noName.Audit.Entries.ShouldBeEmpty();
        noName.Added.ShouldBeEmpty();
    }

    [Fact]
    public async Task AnUnknownLineIsRefusedOnThePrefixedLineField()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { PublicWebsite = new OrderPublicWebsiteFields(true, false, Guid.NewGuid(), null) }, TestContext.Current.CancellationToken);

        Fields(result).Keys.ShouldBe(["publicWebsite.productLineId"]);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ACancelledOrderWithAnyBlockAnswersTheCancelledMessageAndSavesNothing()
    {
        var harness = new Harness();
        harness.Order.ChangeStatus(OrderStatus.Cancelled, CallerId, Now).IsSuccess.ShouldBeTrue();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { Notes = "x", PublicWebsite = new OrderPublicWebsiteFields(false, false, null, null) }, TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Code.ShouldBe("orders.public-cancelled");
        result.Error.Message.ShouldBe("Cancelled orders can't be shown on the website.");
        harness.Unit.Saves.ShouldBe(0);
        harness.Order.Notes.ShouldBeNull();
    }

    [Fact]
    public async Task ACancelledOrderWithNoBlockKeepsTheDetailsLockAnswer()
    {
        var harness = new Harness();
        harness.Order.ChangeStatus(OrderStatus.Cancelled, CallerId, Now).IsSuccess.ShouldBeTrue();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { Notes = "x" }, TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("orders.locked");
        await harness.SiteLock.DidNotReceiveWithAnyArgs().TakeAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task ACompletedOrderKeepsTheDetailsLockAnswerWithABlockAndItsPublicSettingsAreNotTouched()
    {
        var harness = new Harness(unitPrice: 0.00m);
        harness.Order.ChangeStatus(OrderStatus.Completed, CallerId, Now).IsSuccess.ShouldBeTrue();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { Notes = "x", PublicWebsite = new OrderPublicWebsiteFields(true, true, null, null) }, TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("orders.locked");
        harness.Order.HasCustomerConsent.ShouldBeFalse();
        harness.Unit.Saves.ShouldBe(0);
        harness.Added.ShouldBeEmpty();
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ABusySiteContentLockIsTheSharedBusy409AndNothingIsSaved()
    {
        var harness = new Harness();
        harness.SiteLock.TakeAsync(Arg.Any<CancellationToken>()).ThrowsAsync(new SiteContentBusyException());

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { PublicWebsite = new OrderPublicWebsiteFields(true, true, null, null) }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AStaleVersionWithABlockIsStaleAndTheBlockIsNotApplied()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(
            harness.Order.Id,
            Valid() with { Version = Convert.ToBase64String([0, 0, 0, 0, 0, 0, 0, 1]), PublicWebsite = new OrderPublicWebsiteFields(true, true, null, null) },
            TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Order.HasCustomerConsent.ShouldBeFalse();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ClearingTheTeamNameOfAShownOrderWithNoBlockIsRefusedOnTheTeamNameField()
    {
        var harness = new Harness();
        harness.Order.SetPublicSettings(new OrderPublicSettings(true, true, null, null), CallerId, Basketball, Now).IsSuccess.ShouldBeTrue();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { TeamName = null }, TestContext.Current.CancellationToken);

        Fields(result).Keys.ShouldBe(["teamName"]);
        Fields(result)["teamName"].ShouldBe(["This order has no team name. Enter the name to show."]);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ClearingTheTeamNameOfAShownOrderIsAllowedWhenAPublicNameIsSet()
    {
        var harness = new Harness();
        harness.Order.SetPublicSettings(new OrderPublicSettings(true, true, null, "Shown Name"), CallerId, Basketball, Now).IsSuccess.ShouldBeTrue();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { TeamName = null }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task ClearingTheTeamNameWhileTheBlockTakesTheOrderOffTheWebsiteIsAllowed()
    {
        var harness = new Harness();
        harness.Order.SetPublicSettings(new OrderPublicSettings(true, true, null, null), CallerId, Basketball, Now).IsSuccess.ShouldBeTrue();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { TeamName = null, PublicWebsite = new OrderPublicWebsiteFields(true, false, null, null) }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Order.IsShownOnWebsite.ShouldBeFalse();
    }

    private static UpdateOrderDetailsRequest Valid() => new(
        "Juan Dela Cruz",
        "Brgy. San Roque Ballers",
        "0917 123 4567",
        "juan.dc@example.com",
        null,
        "2026-10-28",
        "2026-11-11",
        null,
        StoredVersionText);

    private static IReadOnlyDictionary<string, string[]> Fields(Result<OrderDetailResponse> result)
    {
        result.IsFailure.ShouldBeTrue();
        return result.Error.FieldErrors.ShouldNotBeNull();
    }

    private sealed class PassingValidator : AbstractValidator<UpdateOrderDetailsRequest>
    {
    }

    private sealed class Harness
    {
        public Harness(bool noCaller = false, bool found = true, IValidator<UpdateOrderDetailsRequest>? validator = null, decimal unitPrice = 650.00m)
        {
            Audit = new SaveAwareAudit(Unit);
            var items = new[] { new NewOrderItem(JerseyType, "Jersey top", "S-XL", 15, unitPrice) };
            var details = new OrderDetails("Juan Dela Cruz", "Brgy. San Roque Ballers", "0917 123 4567", "juan.dc@example.com", null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null);
            Order = Order.Create(new NewOrder(details, OrderStatus.Pending, items), Guid.NewGuid(), Now).Value;
            typeof(Order).GetProperty(nameof(Order.RowVersion), BindingFlags.Instance | BindingFlags.Public)!.SetValue(Order, StoredVersion);
            Orders = Substitute.For<IOrders>();
            Orders.FindAsync(Arg.Any<Guid>(), Arg.Any<bool>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<Order?>(found ? Order : null));
            Reader = Substitute.For<IOrderReader>();
            Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(Detail()));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            var lines = ProductLineSeed.All.Select(entry => ProductLine.FromSeed(entry, null, null, Now)).ToList();
            Lines = Substitute.For<IProductLines>();
            Lines.ListAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult<IReadOnlyList<ProductLineListRow>>(
                [.. lines.Select(line => new ProductLineListRow(line, line.Id == Basketball ? [JerseyType] : [], 0, 0))]));
            Gallery = Substitute.For<IGalleryEntries>();
            Gallery.GetTopPositionAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult(0));
            Gallery.When(store => store.Add(Arg.Any<GalleryEntry>())).Do(call => Added.Add(call.Arg<GalleryEntry>()));
            SiteLock = Substitute.For<ISiteContentLock>();
            SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
            Handler = new UpdateOrderDetailsHandler(
                Orders, Reader, new FixedCalendar(), Audit, Unit, request, validator ?? new UpdateOrderDetailsRequestValidator(), new OrderPublicWebsiteWriter(Lines, Gallery, SiteLock, Audit));
        }

        public Order Order { get; }

        public IOrders Orders { get; }

        public IOrderReader Reader { get; }

        public IProductLines Lines { get; }

        public IGalleryEntries Gallery { get; }

        public ISiteContentLock SiteLock { get; }

        public List<GalleryEntry> Added { get; } = [];

        public FakeUnitOfWork Unit { get; } = new();

        public SaveAwareAudit Audit { get; }

        public UpdateOrderDetailsHandler Handler { get; }

        private static OrderDetailResponse Detail() => new(
            Guid.NewGuid(),
            "ORD-2026-0001",
            "Juan Dela Cruz",
            null,
            "0917 123 4567",
            null,
            null,
            new DateOnly(2026, 10, 28),
            new DateOnly(2026, 11, 11),
            "pending",
            Now,
            null,
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            new OrderTotalsResponse(0m, 0m, 0m, 0m, 0m, 0m, 0m, 0m, 0m, false),
            new OrderPublicWebsiteDto(false, null, null, false, null, null, null, null, null, 0, false, true),
            new ActorRef(CallerId, "Mina Mercado", false),
            Now,
            null,
            null,
            "AAAAAAAAH6Q=",
            new DateOnly(2026, 10, 28));
    }

    // Remembers how many saves had happened when each entry was recorded, so a test can prove the entry joins the change's save.
    private sealed class SaveAwareAudit(FakeUnitOfWork unit) : IAuditTrail
    {
        public List<(AuditCall Call, int SavesSoFar)> Entries { get; } = [];

        public void Record(string action, string? targetType, string? targetId, string? detail) =>
            Entries.Add((new AuditCall(action, targetType, targetId, detail, Independent: false), unit.Saves));

        public ValueTask RecordIndependentlyAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken) =>
            throw new NotSupportedException("The order audit entry must join the change's own save.");
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}
