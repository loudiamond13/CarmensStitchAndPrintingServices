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
using NSubstitute;

namespace Csps.Application.UnitTests.Orders;

/// <summary>D-09 to D-16, D-38, SEC-07, SEC-08: the handler checks the form, takes the site-content lock, compares the version, files the order, adds or removes its gallery entry and audits, in one save.</summary>
public sealed class SetOrderPublicSettingsHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly byte[] StoredVersion = [0, 0, 0, 0, 0, 0, 31, 164];
    private static readonly string StoredVersionText = Convert.ToBase64String(StoredVersion);
    private static readonly Guid Basketball = ProductLineSeed.All.Single(entry => entry.Key == "basketball").Id;
    private static readonly Guid Volleyball = ProductLineSeed.All.Single(entry => entry.Key == "volleyball").Id;

    [Fact]
    public async Task WithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Show(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AMalformedVersionIsA400OnVersionAndNothingIsLookedUp()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Show() with { Version = "not a version" }, TestContext.Current.CancellationToken);

        Fields(result).Keys.ShouldBe(["version"]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnEmptyBodyIsReportedAsAMissingVersion()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, SetOrderPublicSettingsRequest.Empty, TestContext.Current.CancellationToken);

        Fields(result).Keys.ShouldBe(["version"]);
    }

    [Fact]
    public async Task AnUnknownOrderIsA404AndNothingIsSaved()
    {
        var harness = new Harness(found: false);

        var result = await harness.Handler.HandleAsync(Guid.NewGuid(), Show(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
        harness.Unit.Saves.ShouldBe(0);
        await harness.Reader.DidNotReceiveWithAnyArgs().GetDetailAsync(default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task ADifferentVersionIsStaleAndNothingIsChangedOrSaved()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Show() with { Version = Convert.ToBase64String([0, 0, 0, 0, 0, 0, 31, 165]) }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Order.HasCustomerConsent.ShouldBeFalse();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ALostRaceAtSaveTimeIsStaleAndIsNotRetried()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Show(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(1);
        await harness.Orders.Received(1).FindAsync(harness.Order.Id, false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ABusySiteContentLockIsABusyAnswerAndNothingIsRead()
    {
        var harness = new Harness();
        harness.SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(_ => Task.FromException(new SiteContentBusyException()));

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Show(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
        await harness.Orders.DidNotReceiveWithAnyArgs().FindAsync(default, default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task ALineThatDoesNotExistIsA400OnTheLineAndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Show() with { ProductLineId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        Fields(result)["productLineId"].ShouldBe(["Choose the product line to show this order under."]);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnOrderShownTakesTheLockFirstAddsItsEntryAtTheTopAuditsAndSavesOnce()
    {
        var harness = new Harness();
        harness.Gallery.GetTopPositionAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult(-3));

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Show(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        Received.InOrder(() =>
        {
            harness.SiteLock.TakeAsync(Arg.Any<CancellationToken>());
            harness.Orders.FindAsync(harness.Order.Id, false, Arg.Any<CancellationToken>());
        });
        var added = harness.Added.ShouldHaveSingleItem();
        added.OrderId.ShouldBe(harness.Order.Id);
        added.Position.ShouldBe(-3);
        added.Kind.ShouldBe(GalleryEntryKind.Order);
        harness.Order.PublicConsentById.ShouldBe(CallerId);
        harness.Order.PublicConsentAtUtc.ShouldBe(Now);
        harness.Order.ShownOnWebsiteSinceUtc.ShouldBe(Now);
        harness.Order.PublicProductLineId.ShouldBeNull();
        harness.Audit.Entries.Select(entry => entry.Action).ShouldBe([AuditActions.OrderPublicConsentRecorded, AuditActions.OrderShownOnWebsite]);
        harness.Audit.Entries.ShouldAllBe(entry => entry.TargetType == "Order" && entry.TargetId == harness.Order.Id.ToString("D") && entry.Detail == "number=ORD-2026-0001");
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        await harness.Reader.Received(1).GetDetailAsync(harness.Order.Id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AChosenLineOtherThanTheAutoLineIsStoredAndTheChangeIsAuditedWithFieldNamesOnly()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Show() with { ProductLineId = Volleyball, PublicName = "Secret Display Name" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Order.PublicProductLineId.ShouldBe(Volleyball);
        var changed = harness.Audit.Entries.Single(entry => entry.Action == AuditActions.OrderPublicDetailsChanged);
        changed.Detail.ShouldBe("number=ORD-2026-0001;fields=line,name");
        harness.Audit.Entries.ShouldAllBe(entry => !(entry.Detail ?? string.Empty).Contains("Secret", StringComparison.Ordinal));
    }

    [Fact]
    public async Task TakingAnOrderOffRemovesItsEntryAndKeepsTheOk()
    {
        var harness = new Harness();
        (await harness.Handler.HandleAsync(harness.Order.Id, Show(), TestContext.Current.CancellationToken)).IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.Clear();
        var existing = harness.Added.Single();
        harness.Gallery.FindForOrderAsync(harness.Order.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<GalleryEntry?>(existing));
        SetVersion(harness.Order, StoredVersion);

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Show() with { ShowOnWebsite = false }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Gallery.Received(1).Remove(existing);
        harness.Order.HasCustomerConsent.ShouldBeTrue();
        harness.Order.IsShownOnWebsite.ShouldBeFalse();
        harness.Audit.Entries.Select(entry => entry.Action).ShouldBe([AuditActions.OrderTakenOffWebsite]);
    }

    [Fact]
    public async Task RemovingTheOkAuditsBothTheRemovalAndTheTakeOffAndSurvivesAMissingEntry()
    {
        var harness = new Harness();
        (await harness.Handler.HandleAsync(harness.Order.Id, Show(), TestContext.Current.CancellationToken)).IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.Clear();
        SetVersion(harness.Order, StoredVersion);

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Show() with { CustomerConsent = false, ShowOnWebsite = false }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Gallery.DidNotReceiveWithAnyArgs().Remove(default!);
        harness.Audit.Entries.Select(entry => entry.Action).ShouldBe([AuditActions.OrderPublicConsentRemoved, AuditActions.OrderTakenOffWebsite]);
    }

    [Fact]
    public async Task AFormWithNoChangeSavesNothingAndRecordsNothing()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Show() with { CustomerConsent = false, ShowOnWebsite = false }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Added.ShouldBeEmpty();
    }

    [Fact]
    public async Task ADomainRefusalSavesNothing()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Show() with { CustomerConsent = false }, TestContext.Current.CancellationToken);

        Fields(result)["showOnWebsite"].ShouldBe(["Tick Customer said OK to show first."]);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ACancelledOrderIsRefusedWith422()
    {
        var harness = new Harness();
        harness.Order.ChangeStatus(OrderStatus.Cancelled, CallerId, Now).IsSuccess.ShouldBeTrue();
        SetVersion(harness.Order, StoredVersion);

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Show(), TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Code.ShouldBe("orders.public-cancelled");
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnOrderTheReaderCannotFindAfterTheSaveIsA404()
    {
        var harness = new Harness();
        harness.Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(null));

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Show(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
    }

    [Fact]
    public async Task ANullRequestIsAProgrammingError()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Handler.HandleAsync(harness.Order.Id, null!, TestContext.Current.CancellationToken));
    }

    private static SetOrderPublicSettingsRequest Show() => new(StoredVersionText, CustomerConsent: true, ShowOnWebsite: true, ProductLineId: null, PublicName: null);

    private static void SetVersion(Order order, byte[] version) =>
        typeof(Order).GetProperty(nameof(Order.RowVersion), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order, version);

    private static IReadOnlyDictionary<string, string[]> Fields(Result<OrderDetailResponse> result)
    {
        result.IsFailure.ShouldBeTrue();
        return result.Error.FieldErrors.ShouldNotBeNull();
    }

    private sealed class Harness
    {
        public Harness(bool noCaller = false, bool found = true)
        {
            var items = new[] { new NewOrderItem(JerseyType, "Jersey top", "S-XL", 15, 650.00m) };
            var details = new OrderDetails("Juan Dela Cruz", "Brgy. San Roque Ballers", "0917 123 4567", "juan.dc@example.com", null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null);
            Order = Order.Create(new NewOrder(details, OrderStatus.Pending, items), Guid.NewGuid(), Now).Value;
            Order.AssignNumber("ORD-2026-0001");
            SetVersion(Order, StoredVersion);

            Orders = Substitute.For<IOrders>();
            Orders.FindAsync(Arg.Any<Guid>(), Arg.Any<bool>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<Order?>(found ? Order : null));
            Reader = Substitute.For<IOrderReader>();
            Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(Detail()));

            var lines = ProductLineSeed.All.Select(entry => ProductLine.FromSeed(entry, null, null, Now)).ToList();
            Lines = Substitute.For<IProductLines>();
            Lines.ListAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult<IReadOnlyList<ProductLineListRow>>(
                [.. lines.Select(line => new ProductLineListRow(line, line.Id == Basketball ? [JerseyType] : [], 0, 0))]));

            Gallery = Substitute.For<IGalleryEntries>();
            Gallery.GetTopPositionAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult(0));
            Gallery.When(store => store.Add(Arg.Any<GalleryEntry>())).Do(call => Added.Add(call.Arg<GalleryEntry>()));

            SiteLock = Substitute.For<ISiteContentLock>();
            SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);

            var time = Substitute.For<TimeProvider>();
            time.GetUtcNow().Returns(Now);
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new SetOrderPublicSettingsHandler(
                Orders, Reader, new OrderPublicWebsiteWriter(Lines, Gallery, SiteLock, Audit), Unit, request, time, new SetOrderPublicSettingsRequestValidator());
        }

        public Order Order { get; }

        public IOrders Orders { get; }

        public IOrderReader Reader { get; }

        public IProductLines Lines { get; }

        public IGalleryEntries Gallery { get; }

        public ISiteContentLock SiteLock { get; }

        public List<GalleryEntry> Added { get; } = [];

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public SetOrderPublicSettingsHandler Handler { get; }

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
}
