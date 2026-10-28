using System.Reflection;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Orders;

/// <summary>ORD-16, ORD-17, D-31, D-38: the status handler checks the key, moves the order by the owner's table on the latest state, and saves once with its audit entry.</summary>
public sealed class ChangeOrderStatusHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid Cash = Guid.Parse("01a17fce-7806-77e1-91b7-d3b852f2fd1d");

    [Fact]
    public async Task WithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(harness.OrderId, new ChangeOrderStatusRequest("mockup"), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("shipped")]
    [InlineData("In Production")]
    public async Task AStatusThatIsNotOneOfTheSevenKeysIsA400OnStatusAndNothingIsLoaded(string? status)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.OrderId, new ChangeOrderStatusRequest(status), TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors!["status"].ShouldBe(["Choose a status."]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task TheEmptyRequestIsTheSameAs400OnStatus()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.OrderId, ChangeOrderStatusRequest.Empty, TestContext.Current.CancellationToken);

        result.Error.FieldErrors!.Keys.ShouldBe(["status"]);
    }

    [Theory]
    [InlineData("MOCKUP")]
    [InlineData(" mockup ")]
    public async Task TheKeyIgnoresCaseAndSurroundingSpaces(string key)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.OrderId, new ChangeOrderStatusRequest(key), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Status.ShouldBe(OrderStatus.Mockup);
    }

    [Fact]
    public async Task AMissingOrderIsA404()
    {
        var harness = new Harness(found: false);

        var result = await harness.Handler.HandleAsync(harness.OrderId, new ChangeOrderStatusRequest("mockup"), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AMoveSavesOnceNamesTheCallerInTheHistoryAndRecordsOneStatusChangedEntryInTheSameSave()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.OrderId, new ChangeOrderStatusRequest("production"), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(1);
        harness.Last.StatusChanges[^1].ChangedById.ShouldBe(CallerId);
        harness.Last.StatusChanges[^1].ChangedAtUtc.ShouldBe(Now);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.ShouldBe(new AuditCall(AuditActions.OrderStatusChanged, "Order", harness.OrderId.ToString("D"), "status=pending>production", Independent: false));
        entry.SavesSoFar.ShouldBe(0);
        harness.LockedAtSave.ShouldBe([0]);
    }

    [Fact]
    public async Task AReopenRecordsOneReopenedEntryAndNoStatusChangedEntry()
    {
        var harness = new Harness(startAt: OrderStatus.Completed);

        var result = await harness.Handler.HandleAsync(harness.OrderId, new ChangeOrderStatusRequest("ready"), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.Action.ShouldBe(AuditActions.OrderReopened);
        entry.Call.Detail.ShouldBe("status=completed>ready");
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task ASameStatusRequestSavesNothingRecordsNothingAndAnswersWithTheOrder()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.OrderId, new ChangeOrderStatusRequest("pending"), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.LockedAtSave.ShouldBeEmpty();
        await harness.Reader.Received(1).GetDetailAsync(harness.OrderId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CompletingWhileMoneyIsOwedIs422WithTheBalanceOwedCodeAndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.OrderId, new ChangeOrderStatusRequest("completed"), TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Code.ShouldBe("orders.complete-balance-owed");
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(OrderStatus.Completed, "cancelled", "orders.reopen-first")]
    [InlineData(OrderStatus.Cancelled, "completed", "orders.reopen-first")]
    public async Task AnEndStateToTheOtherEndStateIsRefusedWithReopenFirst(OrderStatus startAt, string key, string code)
    {
        var harness = new Harness(startAt: startAt);

        var result = await harness.Handler.HandleAsync(harness.OrderId, new ChangeOrderStatusRequest(key), TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe(code);
        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ALostRaceIsReadAgainAndDecidedAgainOnce()
    {
        var harness = new Harness();
        harness.FailLocks(1);

        var result = await harness.Handler.HandleAsync(harness.OrderId, new ChangeOrderStatusRequest("mockup"), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.LockedAtSave.Count.ShouldBe(2);
        harness.Unit.Saves.ShouldBe(1);
        harness.Audit.Entries.ShouldHaveSingleItem();
    }

    [Fact]
    public async Task TwoLostRacesAreTheStaleConflict()
    {
        var harness = new Harness();
        harness.FailLocks(2);

        var result = await harness.Handler.HandleAsync(harness.OrderId, new ChangeOrderStatusRequest("mockup"), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ACallWithoutARequestIsAProgrammingError()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Handler.HandleAsync(harness.OrderId, null!, TestContext.Current.CancellationToken));
    }

    private sealed class Harness
    {
        private readonly OrderStatus _startAt;
        private readonly List<Order> _loaded = [];
        private int _lockFailures;

        public Harness(bool noCaller = false, bool found = true, OrderStatus startAt = OrderStatus.Pending)
        {
            _startAt = startAt;
            Audit = new SaveAwareAudit(Unit);
            var seed = Make(null);
            OrderId = seed.Id;
            Orders = Substitute.For<IOrders>();
            Orders.FindAsync(Arg.Any<Guid>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
                .Returns(_ => Task.FromResult<Order?>(found ? Load(seed) : null));
            Orders.LockAsync(Arg.Any<Order>(), Arg.Any<CancellationToken>()).Returns(_ =>
            {
                LockedAtSave.Add(Unit.Saves);
                if (_lockFailures > 0)
                {
                    _lockFailures--;
                    throw new ConcurrencyConflictException(new InvalidOperationException("The order was changed after it was loaded."));
                }

                return Task.CompletedTask;
            });
            Reader = Substitute.For<IOrderReader>();
            Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(Detail()));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new ChangeOrderStatusHandler(Orders, Reader, new FixedCalendar(), Audit, Unit, request, new ChangeOrderStatusRequestValidator());
        }

        public Guid OrderId { get; }

        public IOrders Orders { get; }

        public IOrderReader Reader { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public SaveAwareAudit Audit { get; }

        public List<int> LockedAtSave { get; } = [];

        public ChangeOrderStatusHandler Handler { get; }

        public Order Last => _loaded[^1];

        public void FailLocks(int count) => _lockFailures = count;

        private Order Load(Order seed)
        {
            var copy = Make(seed.Id);
            _loaded.Add(copy);
            return copy;
        }

        // A fully paid order, so Completed is allowed when the test starts from an end state; the unpaid case uses the pending order.
        private Order Make(Guid? id)
        {
            var items = new List<NewOrderItem> { new(JerseyType, "Jersey top", "S-XL", 15, 650.00m) };
            var details = new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null);
            var payments = _startAt is OrderStatus.Completed ? new[] { new NewOrderPayment(new DateOnly(2026, 10, 28), 9750.00m, Cash, null, null, CallerId) } : [];
            var order = Order.Create(new NewOrder(details, OrderStatus.Pending, items) { Payments = payments }, Guid.NewGuid(), Now, new DateOnly(2026, 10, 28)).Value;
            if (_startAt is OrderStatus.Completed or OrderStatus.Cancelled)
            {
                order.ChangeStatus(_startAt, CallerId, Now).IsSuccess.ShouldBeTrue();
            }

            if (id is { } fixedId)
            {
                typeof(Order).GetProperty(nameof(Order.Id), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order, fixedId);
            }

            return order;
        }

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
            new OrderTotalsResponse(0m, 0m, 0m, 0m, 0m, 0m, 0m, 0m, 0m, false),
            new ActorRef(CallerId, "Mina Mercado", false),
            Now,
            null,
            null,
            "AAAAAAAAH6Q=");
    }

    private sealed class SaveAwareAudit(FakeUnitOfWork unit) : IAuditTrail
    {
        public List<(AuditCall Call, int SavesSoFar)> Entries { get; } = [];

        public void Record(string action, string? targetType, string? targetId, string? detail) =>
            Entries.Add((new AuditCall(action, targetType, targetId, detail, Independent: false), unit.Saves));

        public ValueTask RecordIndependentlyAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken) =>
            throw new NotSupportedException("The status audit entries must join the change's own save.");
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}
