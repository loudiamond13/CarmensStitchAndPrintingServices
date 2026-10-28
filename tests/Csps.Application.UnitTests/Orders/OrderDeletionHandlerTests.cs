using System.Reflection;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Orders;
using NSubstitute;

namespace Csps.Application.UnitTests.Orders;

/// <summary>
/// ORD-06, D-28, D-29: a permanent delete needs the exact order number, writes the audit entry first with the money facts and no
/// customer text, removes the order in the same save, and answers 404 for an order that is gone.
/// </summary>
public sealed class OrderDeletionHandlerTests
{
    private const string ConfirmMessage = "Type the order number exactly to delete it for good.";
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 28);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid Receiver = Guid.Parse("2f9a6d10-58b3-4c7e-8a41-d03e7b95c628");

    [Fact]
    public async Task PermanentWithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Permanent.HandleAsync(harness.Order.Id, "ORD-2026-0148", TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task PermanentAnUnknownOrderIs404BeforeTheConfirmIsChecked()
    {
        var harness = new Harness();

        var result = await harness.Permanent.HandleAsync(Guid.NewGuid(), null, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
        harness.Orders.DidNotReceiveWithAnyArgs().Remove(default!);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("ord-2026-0148")]
    [InlineData(" ORD-2026-0148")]
    [InlineData("ORD-2026-0148 ")]
    [InlineData("ORD-2026-014")]
    [InlineData("ORD-2026-0149")]
    public async Task PermanentAConfirmThatIsMissingOrNotTheExactNumberIsA400OnConfirmAndNothingIsRemoved(string? confirm)
    {
        var harness = new Harness();

        var result = await harness.Permanent.HandleAsync(harness.Order.Id, confirm, TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe("orders.invalid-request");
        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["confirm"]);
        result.Error.FieldErrors["confirm"].ShouldBe([ConfirmMessage]);
        harness.Orders.DidNotReceiveWithAnyArgs().Remove(default!);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task PermanentALiveOrSoftDeletedOrderIsFoundIncludingDeletedAndRemovedWithOneSave(bool deleted)
    {
        var harness = new Harness();
        if (deleted)
        {
            harness.Order.SoftDelete(CallerId, Now).ShouldBeTrue();
        }

        var result = await harness.Permanent.HandleAsync(harness.Order.Id, "ORD-2026-0148", TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Orders.Received(1).FindAsync(harness.Order.Id, true, Arg.Any<CancellationToken>());
        harness.Orders.Received(1).Remove(harness.Order);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task PermanentTheAuditEntryIsRecordedBeforeTheRemoveAndTheSaveWithTheSnapshotAndNoCustomerText()
    {
        var harness = new Harness();

        await harness.Permanent.HandleAsync(harness.Order.Id, "ORD-2026-0148", TestContext.Current.CancellationToken);

        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.ShouldBe(new AuditCall(
            AuditActions.OrderPermanentlyDeleted,
            "Order",
            harness.Order.Id.ToString("D"),
            OrderAuditDetail.PermanentlyDeleted(harness.Order),
            Independent: false));
        entry.RemovedBefore.ShouldBeFalse();
        entry.SavesBefore.ShouldBe(0);
        foreach (var secret in new[] { "Juan", "Ballers", "0917", "juan.dc", "Brgy.", "rush" })
        {
            entry.Call.Detail.ShouldNotBeNull().ShouldNotContain(secret, Case.Insensitive);
        }
    }

    [Fact]
    public async Task PermanentALostRaceIsReadAgainAndDecidedAgain()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Permanent.HandleAsync(harness.Order.Id, "ORD-2026-0148", TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task PermanentARaceThatLeavesNothingToRemoveIs404()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();
        harness.Orders.FindAsync(harness.Order.Id, true, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<Order?>(harness.Order), Task.FromResult<Order?>(null));

        var result = await harness.Permanent.HandleAsync(harness.Order.Id, "ORD-2026-0148", TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task PermanentTwoLostRacesAnswerTheStaleVersionConflict()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Permanent.HandleAsync(harness.Order.Id, "ORD-2026-0148", TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(2);
        harness.Unit.Commits.ShouldBe(0);
    }

    // Notes, for every entry, whether the remove and the save had already happened when it was recorded.
    private sealed class OrderAudit(IOrders orders, FakeUnitOfWork unit) : IAuditTrail
    {
        public List<(AuditCall Call, bool RemovedBefore, int SavesBefore)> Entries { get; } = [];

        public void Record(string action, string? targetType, string? targetId, string? detail) =>
            Entries.Add((
                new AuditCall(action, targetType, targetId, detail, Independent: false),
                orders.ReceivedCalls().Any(call => call.GetMethodInfo().Name == nameof(IOrders.Remove)),
                unit.Saves));

        public ValueTask RecordIndependentlyAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken) =>
            throw new NotSupportedException("The order audit entries must join the one save.");
    }

    private sealed class Harness
    {
        public Harness(bool noCaller = false)
        {
            var items = new[] { new NewOrderItem(Guid.NewGuid(), "Jersey top", "S-XL", 15, 650.00m) };
            var payments = new[] { new NewOrderPayment(Today, 4000.00m, Guid.NewGuid(), null, null, Receiver) };
            var details = new OrderDetails("Juan Dela Cruz", "Brgy. San Roque Ballers", "0917 123 4567", "juan.dc@example.com", "Brgy. San Roque", Today, Today.AddDays(14), "rush job");
            Order = Order.Create(new NewOrder(details, OrderStatus.Pending, items) { Payments = payments }, CallerId, Now, Today).Value;
            Order.AssignNumber("ORD-2026-0148");
            Orders = Substitute.For<IOrders>();
            Orders.FindAsync(Order.Id, true, Arg.Any<CancellationToken>()).Returns(Task.FromResult<Order?>(Order));
            Audit = new OrderAudit(Orders, Unit);
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Permanent = new PermanentlyDeleteOrderHandler(Orders, Audit, Unit, request);
        }

        public Order Order { get; }

        public IOrders Orders { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public OrderAudit Audit { get; }

        public PermanentlyDeleteOrderHandler Permanent { get; }
    }
}
