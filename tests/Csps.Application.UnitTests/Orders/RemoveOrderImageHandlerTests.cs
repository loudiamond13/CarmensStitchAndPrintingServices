using System.Reflection;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Orders;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Orders;

/// <summary>
/// ORD-04, JOB-02, D-19, D-20: a photo delete finds the photo on the order only, queues its file and records the audit entry in the
/// same save as the removal, calls no storage, and is read again once after a lost race.
/// </summary>
public sealed class RemoveOrderImageHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");

    [Fact]
    public async Task WithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.PhotoIds[0], TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
        harness.Queue.Calls.ShouldBeEmpty();
    }

    [Fact]
    public async Task ADeleteQueuesTheFileAndRecordsTheEntryInTheSameSaveAsTheRemoval()
    {
        var harness = new Harness();

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.PhotoIds[1], TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        harness.Queue.Calls.ShouldBe([("csps-test/orders/photo-1", ImageDeletionReason.PhotoDeleted, 0)]);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.OrderImageDeleted);
        entry.TargetType.ShouldBe("Order");
        entry.TargetId.ShouldBe(harness.OrderId.ToString("D"));
        entry.Detail.ShouldBe("number=ORD-2026-0148;position=2");
        harness.Last.Images.Select(image => image.PublicId).ShouldBe(["csps-test/orders/photo-0", "csps-test/orders/photo-2"]);
        harness.Last.Images.Select(image => image.Position).Order().ShouldBe([0, 1]);
        await harness.Reader.Received(1).GetDetailAsync(harness.OrderId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task APhotoThatIsNotOnTheOrderIsA404AndNothingIsQueuedOrSaved()
    {
        var harness = new Harness();

        var result = await harness.Remove.HandleAsync(harness.OrderId, Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderImageRules.ImageNotFound);
        harness.Queue.Calls.ShouldBeEmpty();
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnUnknownOrderIsA404()
    {
        var harness = new Harness(found: false);

        var result = await harness.Remove.HandleAsync(Guid.NewGuid(), Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
        harness.Queue.Calls.ShouldBeEmpty();
    }

    [Fact]
    public async Task ACancelledOrderIsA422LockedAndNothingIsQueuedOrSaved()
    {
        var harness = new Harness(cancelled: true);

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.PhotoIds[0], TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe(OrderRules.LockedCode);
        harness.Queue.Calls.ShouldBeEmpty();
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ADeleteThatLosesOneRaceReadsTheOrderAgainAndDecidesAgain()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.PhotoIds[0], TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
        harness.Last.Images.Count.ShouldBe(2);
    }

    [Fact]
    public async Task ADeleteThatLosesTwoRacesIsTheStaleVersion409()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.PhotoIds[0], TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(2);
    }

    private sealed class Harness
    {
        private readonly List<Order> _loaded = [];
        private readonly Guid _orderId = Guid.NewGuid();

        public Harness(bool noCaller = false, bool found = true, bool cancelled = false)
        {
            PhotoIds = [Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()];
            Audit = new SaveAwareAudit(Unit);
            Queue = new RecordingQueue(Unit);
            Orders = Substitute.For<IOrders>();
            Orders.FindAsync(Arg.Any<Guid>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
                .Returns(_ => Task.FromResult<Order?>(found ? Load(cancelled) : null));
            Reader = Substitute.For<IOrderReader>();
            Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(Detail()));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Remove = new RemoveOrderImageHandler(Orders, Reader, new FixedCalendar(), Audit, Queue, Unit, request);
        }

        public Guid OrderId => _orderId;

        public Guid[] PhotoIds { get; }

        public IOrders Orders { get; }

        public IOrderReader Reader { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public SaveAwareAudit Audit { get; }

        public RecordingQueue Queue { get; }

        public RemoveOrderImageHandler Remove { get; }

        /// <summary>Gets the order instance the handler worked on last.</summary>
        public Order Last => _loaded[^1];

        // Every load gives a fresh copy with the same ids, as a new read from the store would after a rolled back attempt.
        private Order Load(bool cancelled)
        {
            var details = new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null);
            var order = Order.Create(new NewOrder(details, OrderStatus.Pending, [new NewOrderItem(Guid.NewGuid(), "Jersey top", "S-XL", 15, 650.00m)]), CallerId, Now).Value;
            order.AssignNumber("ORD-2026-0148");
            typeof(Order).GetProperty(nameof(Order.Id), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order, _orderId);
            for (var index = 0; index < PhotoIds.Length; index++)
            {
                var added = order.AddImage(new NewOrderImage($"csps-test/orders/photo-{index}", 640, 480, 1000, "jpg", null), Now.AddMinutes(index));
                typeof(OrderImage).GetProperty(nameof(OrderImage.Id), BindingFlags.Instance | BindingFlags.Public)!.SetValue(added.Value, PhotoIds[index]);
            }

            if (cancelled)
            {
                order.ChangeStatus(OrderStatus.Cancelled, CallerId, Now.AddHours(1)).IsSuccess.ShouldBeTrue();
            }

            _loaded.Add(order);
            return order;
        }

        private static OrderDetailResponse Detail() => new(
            Guid.NewGuid(),
            "ORD-2026-0148",
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
        public List<AuditCall> Entries { get; } = [];

        public void Record(string action, string? targetType, string? targetId, string? detail) =>
            Entries.Add(new AuditCall(action, targetType, targetId, detail, Independent: false));

        public ValueTask RecordIndependentlyAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken) =>
            throw new NotSupportedException($"The photo delete entry must join the change's own save (saves so far: {unit.Saves}).");
    }

    // Keeps each queued file with the number of saves so far, so a test can prove the row is added before the one save.
    private sealed class RecordingQueue(FakeUnitOfWork unit) : IImageDeletionQueue
    {
        public List<(string PublicId, ImageDeletionReason Reason, int SavesSoFar)> Calls { get; } = [];

        public void Enqueue(string publicId, ImageDeletionReason reason) => Calls.Add((publicId, reason, unit.Saves));

        public Task EnqueueNowAsync(string publicId, ImageDeletionReason reason, CancellationToken cancellationToken) =>
            throw new NotSupportedException("A photo delete queues its file in its own save, never on a separate context.");
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}
