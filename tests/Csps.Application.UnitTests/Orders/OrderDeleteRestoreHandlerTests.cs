using System.Reflection;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Orders;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Orders;

/// <summary>
/// ORD-06, D-26, D-28, D-31: delete and restore apply to the latest state in one transaction with one audit entry, an order that is
/// gone or not deleted is a 404 that writes nothing, the deleted list checks its query first, and a lost race is decided again.
/// </summary>
public sealed class OrderDeleteRestoreHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 28);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid Receiver = Guid.Parse("2f9a6d10-58b3-4c7e-8a41-d03e7b95c628");

    [Fact]
    public async Task DeleteWithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Delete.HandleAsync(harness.Order.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task DeleteAnUnknownOrderIsA404AndNothingIsLockedSavedOrAudited()
    {
        var harness = new Harness();

        var result = await harness.Delete.HandleAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
        await harness.Orders.DidNotReceive().LockAsync(Arg.Any<Order>(), Arg.Any<CancellationToken>());
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task DeleteAnOrderThatIsAlreadyMarkedDeletedIsA404AndNothingIsWritten()
    {
        var harness = new Harness();
        harness.Order.SoftDelete(Receiver, Now.AddHours(-1)).ShouldBeTrue();
        harness.Orders.FindAsync(harness.Order.Id, false, Arg.Any<CancellationToken>()).Returns(Task.FromResult<Order?>(harness.Order));

        var result = await harness.Delete.HandleAsync(harness.Order.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Order.DeletedById.ShouldBe(Receiver);
    }

    [Fact]
    public async Task DeleteMarksTheCallerAndTheServerTimeLocksThenRecordsOneEntryThenSavesOnce()
    {
        var harness = new Harness();

        var result = await harness.Delete.HandleAsync(harness.Order.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Order.DeletedById.ShouldBe(CallerId);
        harness.Order.DeletedAtUtc.ShouldBe(Now);
        await harness.Orders.Received(1).FindAsync(harness.Order.Id, false, Arg.Any<CancellationToken>());
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.ShouldBe(new AuditCall(
            AuditActions.OrderDeleted,
            "Order",
            harness.Order.Id.ToString("D"),
            "number=ORD-2026-0148;status=pending;total=9750.00;paid=4000.00;balance=5750.00",
            Independent: false));
        entry.LockedBefore.ShouldBeTrue();
        entry.SavesBefore.ShouldBe(0);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task DeleteALostRaceIsReadAgainAndDecidedAgain()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Delete.HandleAsync(harness.Order.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
        harness.Unit.Rollbacks.ShouldBe(1);
    }

    [Fact]
    public async Task DeleteTwoLostRacesAnswerTheStaleVersionConflict()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Delete.HandleAsync(harness.Order.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task RestoreWithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Restore.HandleAsync(harness.Order.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task RestoreAnUnknownOrderOrOneThatIsNotDeletedIsA404AndNothingIsWritten()
    {
        var harness = new Harness();

        var unknown = await harness.Restore.HandleAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);
        var live = await harness.Restore.HandleAsync(harness.Order.Id, TestContext.Current.CancellationToken);

        unknown.Error.ShouldBe(OrderErrors.NotFound);
        live.Error.ShouldBe(OrderErrors.NotFound);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task RestoreClearsTheMarkAndRecordsOneEntryBeforeTheSingleSave()
    {
        var harness = new Harness();
        harness.StartDeleted();

        var result = await harness.Restore.HandleAsync(harness.Order.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Order.IsDeleted.ShouldBeFalse();
        await harness.Orders.Received(1).FindAsync(harness.Order.Id, true, Arg.Any<CancellationToken>());
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.ShouldBe(new AuditCall(
            AuditActions.OrderRestored,
            "Order",
            harness.Order.Id.ToString("D"),
            "number=ORD-2026-0148;status=pending;total=9750.00;paid=4000.00;balance=5750.00",
            Independent: false));
        entry.SavesBefore.ShouldBe(0);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task RestoreALostRaceIsReadAgainAndTwoLostRacesAnswerTheStaleVersionConflict()
    {
        var once = new Harness();
        once.StartDeleted();
        once.Unit.FailFirstSaveWithConflict();
        var twice = new Harness();
        twice.StartDeleted();
        twice.Unit.FailEverySaveWithConflict();

        var recovered = await once.Restore.HandleAsync(once.Order.Id, TestContext.Current.CancellationToken);
        var busy = await twice.Restore.HandleAsync(twice.Order.Id, TestContext.Current.CancellationToken);

        recovered.IsSuccess.ShouldBeTrue();
        once.Unit.Saves.ShouldBe(2);
        busy.Error.ShouldBe(EditErrors.Stale);
    }

    [Fact]
    public async Task ListWithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.List.HandleAsync(new ListDeletedOrdersRequest(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        await harness.Reader.DidNotReceive().ListDeletedAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(0, 20, "page", "Use a page from 1 to 100000.")]
    [InlineData(100001, 20, "page", "Use a page from 1 to 100000.")]
    [InlineData(1, 0, "pageSize", "Use a page size from 1 to 100.")]
    [InlineData(1, 101, "pageSize", "Use a page size from 1 to 100.")]
    public async Task ListABadPageOrPageSizeIsA400AndTheReaderIsNeverCalled(int page, int pageSize, string field, string message)
    {
        var harness = new Harness();

        var result = await harness.List.HandleAsync(new ListDeletedOrdersRequest(page, pageSize), TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("orders.invalid-request");
        result.Error.FieldErrors.ShouldNotBeNull().Keys.Select(static key => key.ToLowerInvariant()).ShouldBe([field.ToLowerInvariant()]);
        result.Error.FieldErrors.Values.Single().ShouldBe([message]);
        await harness.Reader.DidNotReceive().ListDeletedAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(100000, 100)]
    public async Task ListTheEdgesOfThePageAndPageSizeAreAccepted(int page, int pageSize)
    {
        var harness = new Harness();

        var result = await harness.List.HandleAsync(new ListDeletedOrdersRequest(page, pageSize), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Reader.Received(1).ListDeletedAsync(page, pageSize, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ListMapsTheRowsWithTheStatusKeyAndCarriesThePageAndTheTotal()
    {
        var harness = new Harness();
        var by = new ActorRef(CallerId, "Mina Mercado", false);
        harness.Reader.ListDeletedAsync(2, 5, Arg.Any<CancellationToken>()).Returns(Task.FromResult(new DeletedOrderPage(
        [
            new DeletedOrderRow(harness.Order.Id, "ORD-2026-0148", "Juan Dela Cruz", null, OrderStatus.InProduction, 9750.00m, 4000.00m, 5750.00m, Now, by),
            new DeletedOrderRow(Guid.NewGuid(), "ORD-2026-0149", "Ana Reyes", "Riders", OrderStatus.Cancelled, 100.00m, 0.00m, 100.00m, Now.AddHours(-1), null),
        ],
        12)));

        var result = await harness.List.HandleAsync(new ListDeletedOrdersRequest(2, 5), TestContext.Current.CancellationToken);

        var page = result.Value;
        page.Total.ShouldBe(12);
        page.Page.ShouldBe(2);
        page.PageSize.ShouldBe(5);
        page.Items.Count.ShouldBe(2);
        page.Items[0].ShouldBe(new DeletedOrderListItem(harness.Order.Id, "ORD-2026-0148", "Juan Dela Cruz", null, "production", 9750.00m, 4000.00m, 5750.00m, Now, by));
        page.Items[1].Status.ShouldBe("cancelled");
        page.Items[1].DeletedBy.ShouldBeNull();
    }

    [Fact]
    public void TheDefaultPageIsTheFirstOfTwentyAndANullRequestIsAProgrammingError()
    {
        var request = new ListDeletedOrdersRequest();

        request.Page.ShouldBe(1);
        request.PageSize.ShouldBe(20);
        Should.Throw<ArgumentNullException>(() => new Harness().List.HandleAsync(null!, TestContext.Current.CancellationToken));
    }

    // Notes, for every entry, whether the order had been locked and how many saves had happened when it was recorded.
    private sealed class OrderAudit(IOrders orders, FakeUnitOfWork unit) : IAuditTrail
    {
        public List<(AuditCall Call, bool LockedBefore, int SavesBefore)> Entries { get; } = [];

        public void Record(string action, string? targetType, string? targetId, string? detail) =>
            Entries.Add((
                new AuditCall(action, targetType, targetId, detail, Independent: false),
                orders.ReceivedCalls().Any(call => call.GetMethodInfo().Name == nameof(IOrders.LockAsync)),
                unit.Saves));

        public ValueTask RecordIndependentlyAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken) =>
            throw new NotSupportedException("The order audit entries must join the one save.");
    }

    private sealed class Harness
    {
        private bool _startDeleted;
        private int _rollbacksSeen;

        public Harness(bool noCaller = false)
        {
            var items = new[] { new NewOrderItem(Guid.NewGuid(), "Jersey top", "S-XL", 15, 650.00m) };
            var payments = new[] { new NewOrderPayment(Today, 4000.00m, Guid.NewGuid(), null, null, Receiver) };
            var details = new OrderDetails("Juan Dela Cruz", "Brgy. San Roque Ballers", "0917 123 4567", "juan.dc@example.com", "Brgy. San Roque", Today, Today.AddDays(14), "rush job");
            Order = Order.Create(new NewOrder(details, OrderStatus.Pending, items) { Payments = payments }, CallerId, Now, Today).Value;
            Order.AssignNumber("ORD-2026-0148");
            Orders = Substitute.For<IOrders>();
            Orders.FindAsync(Order.Id, false, Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult(Load(includeDeleted: false)));
            Orders.FindAsync(Order.Id, true, Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult(Load(includeDeleted: true)));
            Audit = new OrderAudit(Orders, Unit);
            Reader = Substitute.For<IOrderReader>();
            Reader.ListDeletedAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult(new DeletedOrderPage([], 0)));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            var time = new FakeTimeProvider(Now);
            Delete = new DeleteOrderHandler(Orders, Audit, Unit, request, time);
            Restore = new RestoreOrderHandler(Orders, Audit, Unit, request);
            List = new ListDeletedOrdersHandler(Reader, request, new ListDeletedOrdersRequestValidator());
        }

        public Order Order { get; }

        public IOrders Orders { get; }

        public IOrderReader Reader { get; }

        /// <summary>Starts the order as deleted; a rolled-back attempt puts it back to this state, as a fresh read would.</summary>
        public void StartDeleted()
        {
            _startDeleted = true;
            Order.SoftDelete(Receiver, Now.AddHours(-1)).ShouldBeTrue();
        }

        private Order? Load(bool includeDeleted)
        {
            if (Unit.Rollbacks > _rollbacksSeen)
            {
                _rollbacksSeen = Unit.Rollbacks;
                if (_startDeleted)
                {
                    Order.Restore();
                    Order.SoftDelete(Receiver, Now.AddHours(-1));
                }
                else
                {
                    Order.Restore();
                }
            }

            return !includeDeleted && Order.IsDeleted ? null : Order;
        }

        public FakeUnitOfWork Unit { get; } = new();

        public OrderAudit Audit { get; }

        public DeleteOrderHandler Delete { get; }

        public RestoreOrderHandler Restore { get; }

        public ListDeletedOrdersHandler List { get; }
    }
}
