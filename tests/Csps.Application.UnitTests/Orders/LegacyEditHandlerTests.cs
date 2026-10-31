using System.Reflection;
using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Orders;

/// <summary>
/// D-49b: the edit handlers drop a form failure on a field the edit leaves as saved, so an imported legacy value stays while
/// other fields are corrected. A field the edit changes is still checked, and so is a form for an order that does not exist.
/// </summary>
public sealed class LegacyEditHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly DateOnly Today = new(2026, 10, 28);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid Cash = Guid.Parse("01a17fce-7806-77e1-91b7-d3b852f2fd1d");
    private static readonly Guid Fabric = Guid.Parse("01a17fce-780b-75d1-89e0-5b3b9b185a2c");
    private static readonly byte[] StoredVersion = [0, 0, 0, 0, 0, 0, 31, 164];
    private static readonly string StoredVersionText = Convert.ToBase64String(StoredVersion);

    [Fact]
    public async Task APaymentAboveTheCapAndDatedAheadTakesANotesEditButAChangedAmountIsStillA400()
    {
        var legacy = new NewOrderPayment(Today.AddDays(5), 2_000_000.00m, Cash, null, null, CallerId);
        var rig = new Rig(payments: [legacy]);
        var paymentId = rig.Order.Payments[0].Id;
        var same = new UpdateOrderPaymentRequest("2026-11-02", 2_000_000.00m, Cash, null, "Receipt found", CallerId, StoredVersionText);

        var notes = await rig.Payment().HandleAsync(rig.Order.Id, paymentId, same, TestContext.Current.CancellationToken);
        var amount = await rig.Payment().HandleAsync(rig.Order.Id, paymentId, same with { Amount = 1_500_000.00m }, TestContext.Current.CancellationToken);

        notes.IsSuccess.ShouldBeTrue();
        rig.Unit.Saves.ShouldBe(1);
        amount.Error.FieldErrors.ShouldNotBeNull()["amount"].ShouldBe([OrderRules.PaymentAmountOutOfRange]);
        rig.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task AnItemWithQuantityZeroTakesATextEditButAChangedQuantityIsStillChecked()
    {
        var rig = new Rig(items: [new NewOrderItem(JerseyType, "Jersey top", "S-XL", 0, 650.00m), new NewOrderItem(JerseyType, "Polo", null, 1, 100.00m)]);
        var itemId = rig.Order.Items[0].Id;
        var same = new UpdateOrderItemRequest(JerseyType, "Jersey top, long", "S-XL", 0, 650.00m, StoredVersionText);

        var text = await rig.Item().HandleAsync(rig.Order.Id, itemId, same, TestContext.Current.CancellationToken);
        var quantity = await rig.Item().HandleAsync(rig.Order.Id, itemId, same with { Quantity = 10_001 }, TestContext.Current.CancellationToken);

        text.IsSuccess.ShouldBeTrue();
        rig.Unit.Saves.ShouldBe(1);
        quantity.Error.FieldErrors.ShouldNotBeNull()["quantity"].ShouldBe([OrderRules.QuantityOutOfRange]);
    }

    [Fact]
    public async Task AnExpenseAboveTheCapAndDatedFarAheadTakesADescriptionEdit()
    {
        var legacy = new NewOrderExpense(Today.AddDays(60), 2_000_000.00m, Fabric, "Dri-fit mesh", CallerId);
        var rig = new Rig(expenses: [legacy]);
        var request = new UpdateOrderExpenseRequest("2026-12-27", Fabric, "Mesh, corrected", 2_000_000.00m, CallerId, StoredVersionText);

        var result = await rig.Expense().HandleAsync(rig.Order.Id, rig.Order.Expenses[0].Id, request, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        rig.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task ARefundAboveTheCapAndDatedAheadTakesAReasonEdit()
    {
        var legacy = new NewOrderRefund(Today.AddDays(3), 2_000_000.00m, "Order changed", CallerId);
        var rig = new Rig(refunds: [legacy]);
        var request = new UpdateOrderRefundRequest("2026-10-31", 2_000_000.00m, "Customer asked", CallerId, StoredVersionText);

        var result = await rig.Refund().HandleAsync(rig.Order.Id, rig.Order.Refunds[0].Id, request, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        rig.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task ADiscountAboveTheCapTakesAReasonEditButAChangedKindIsStillChecked()
    {
        var rig = new Rig(
            items: [new NewOrderItem(JerseyType, "Jersey top", "S-XL", 1, 5_000_000.00m)],
            discounts: [new NewOrderDiscount(DiscountKind.Fixed, 2_000_000.00m, "Team deal")]);
        var discountId = rig.Order.Discounts[0].Id;
        var same = new UpdateOrderDiscountRequest("fixed", 2_000_000.00m, "Team deal, corrected", StoredVersionText);

        var reason = await rig.Discount().HandleAsync(rig.Order.Id, discountId, same, TestContext.Current.CancellationToken);
        var kind = await rig.Discount().HandleAsync(rig.Order.Id, discountId, same with { Kind = "percentage" }, TestContext.Current.CancellationToken);

        reason.IsSuccess.ShouldBeTrue();
        rig.Unit.Saves.ShouldBe(1);
        kind.Error.FieldErrors.ShouldNotBeNull()["value"].ShouldBe([OrderRules.PercentDiscountOutOfRange]);
    }

    [Fact]
    public async Task AnOrderWithNoContactNumberTakesAnEditOfItsNotesButAStoredNumberCannotBeCleared()
    {
        var rig = new Rig(contactNumber: null);
        var same = new UpdateOrderDetailsRequest("Juan Dela Cruz", null, null, null, null, "2026-10-18", "2026-11-11", "Pick up at the shop", StoredVersionText);

        var notes = await rig.Details().HandleAsync(rig.Order.Id, same, TestContext.Current.CancellationToken);
        var withNumber = new Rig(contactNumber: "0917 123 4567");
        var cleared = await withNumber.Details().HandleAsync(withNumber.Order.Id, same, TestContext.Current.CancellationToken);

        notes.IsSuccess.ShouldBeTrue();
        rig.Unit.Saves.ShouldBe(1);
        cleared.Error.FieldErrors.ShouldNotBeNull()["contactNumber"].ShouldBe([OrderRules.ContactNumberRequired]);
        withNumber.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task WhenTheOrderCannotBeReadTheFormFailureStandsAsBefore()
    {
        var rig = new Rig(payments: [new NewOrderPayment(Today.AddDays(5), 2_000_000.00m, Cash, null, null, CallerId)]);
        rig.Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(null));
        var request = new UpdateOrderPaymentRequest("2026-11-02", 2_000_000.00m, Cash, null, "Receipt found", CallerId, StoredVersionText);

        var result = await rig.Payment().HandleAsync(rig.Order.Id, rig.Order.Payments[0].Id, request, TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull().Keys.Order(StringComparer.Ordinal).ShouldBe(["amount", "paymentDate"]);
        rig.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AValidFormReadsTheOrderOnlyOnceForTheAnswerAndNotForTheComparison()
    {
        var rig = new Rig(payments: [new NewOrderPayment(Today.AddDays(-3), 1_000.00m, Cash, null, null, CallerId)]);
        var request = new UpdateOrderPaymentRequest("2026-10-25", 1_000.00m, Cash, null, "Receipt found", CallerId, StoredVersionText);

        var result = await rig.Payment().HandleAsync(rig.Order.Id, rig.Order.Payments[0].Id, request, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        rig.Reader.ReceivedCalls().Count(static call => call.GetMethodInfo().Name == nameof(IOrderReader.GetDetailAsync)).ShouldBe(1);
    }

    private sealed class Rig
    {
        public Rig(
            IReadOnlyList<NewOrderItem>? items = null,
            IReadOnlyList<NewOrderDiscount>? discounts = null,
            IReadOnlyList<NewOrderPayment>? payments = null,
            IReadOnlyList<NewOrderRefund>? refunds = null,
            IReadOnlyList<NewOrderExpense>? expenses = null,
            string? contactNumber = "0917 123 4567")
        {
            var details = new OrderDetails("Juan Dela Cruz", null, contactNumber, null, null, Today.AddDays(-10), Today.AddDays(14), null);
            var snapshot = new OrderImportSnapshot("ORD-2026-0148", details, OrderStatus.InProduction, items ?? [new NewOrderItem(JerseyType, "Jersey top", "S-XL", 15, 650.00m)])
            {
                Discounts = discounts ?? [],
                Payments = payments ?? [],
                Refunds = refunds ?? [],
                Expenses = expenses ?? [],
            };
            Order = Order.Import(snapshot, OrderImportRules.Default, Now).Value;
            typeof(Order).GetProperty(nameof(Order.RowVersion), BindingFlags.Instance | BindingFlags.Public)!.SetValue(Order, StoredVersion);

            Orders = Substitute.For<IOrders>();
            Orders.FindAsync(Arg.Any<Guid>(), Arg.Any<bool>(), Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<Order?>(Order));
            Reader = Substitute.For<IOrderReader>();
            Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<OrderDetailResponse?>(DetailOf(Order)));
            Request = Substitute.For<IRequestContext>();
            Request.UserId.Returns(CallerId);
        }

        public Order Order { get; }

        public IOrders Orders { get; }

        public IOrderReader Reader { get; }

        public IRequestContext Request { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public UpdateOrderPaymentHandler Payment() =>
            new(Orders, Reader, Substitute.For<IOrderLists>(), Substitute.For<IStaffDirectory>(), new FixedCalendar(), Substitute.For<IAuditTrail>(), Unit, Request, new UpdateOrderPaymentRequestValidator());

        public UpdateOrderItemHandler Item() =>
            new(Orders, Reader, Substitute.For<IOrderLists>(), new FixedCalendar(), Substitute.For<IAuditTrail>(), Unit, Request, new UpdateOrderItemRequestValidator());

        public UpdateOrderExpenseHandler Expense() =>
            new(Orders, Reader, Substitute.For<IOrderLists>(), Substitute.For<IStaffDirectory>(), new FixedCalendar(), Substitute.For<IAuditTrail>(), Unit, Request, new UpdateOrderExpenseRequestValidator());

        public UpdateOrderRefundHandler Refund() =>
            new(Orders, Reader, Substitute.For<IStaffDirectory>(), new FixedCalendar(), Substitute.For<IAuditTrail>(), Unit, Request, new UpdateOrderRefundRequestValidator());

        public UpdateOrderDiscountHandler Discount() =>
            new(Orders, Reader, new FixedCalendar(), Substitute.For<IAuditTrail>(), Unit, Request, new UpdateOrderDiscountRequestValidator());

        public UpdateOrderDetailsHandler Details() =>
            new(Orders, Reader, new FixedCalendar(), Substitute.For<IAuditTrail>(), Unit, Request, new UpdateOrderDetailsRequestValidator());
    }

    private static OrderDetailResponse DetailOf(Order order)
    {
        var person = new ActorRef(CallerId, "Mina Mercado", false);
        var list = new OrderListRef(Guid.NewGuid(), "Entry", "blue", false);
        return new OrderDetailResponse(
            order.Id,
            order.Number,
            order.CustomerName,
            order.TeamName,
            order.ContactNumber,
            order.Email,
            order.Address,
            order.OrderDate,
            order.DueDate,
            "production",
            Now,
            order.Notes,
            [.. order.Items.Select(item => new OrderItemResponse(item.Id, list with { Id = item.ProductTypeId }, item.Description, item.SizeVariant, item.Quantity, item.UnitPrice, item.LineTotal))],
            [.. order.Discounts.Select(discount => new OrderDiscountResponse(discount.Id, DiscountKindNames.ToKey(discount.Kind), discount.Value, discount.Reason, null, Now, null, null))],
            [.. order.Payments.Select(payment => new OrderPaymentResponse(payment.Id, payment.PaymentDate, payment.Amount, list with { Id = payment.PaymentMethodId }, payment.Reference, payment.Notes, person, true, null, Now, null, null))],
            [.. order.Refunds.Select(refund => new OrderRefundResponse(refund.Id, refund.RefundDate, refund.Amount, refund.Reason, person, true, null, Now, null, null))],
            [.. order.Expenses.Select(expense => new OrderExpenseResponse(expense.Id, expense.ExpenseDate, list with { Id = expense.OrderExpenseCategoryId }, expense.Description, expense.Amount, person, true, null, Now, null, null))],
            [],
            new OrderTotalsResponse(order.Subtotal, order.DiscountTotal, order.Total, order.PaidTotal, order.RefundedTotal, order.Balance, order.CustomerCredit, order.ExpensesTotal, order.Profit, order.FullyPaid),
            person,
            Now,
            null,
            null,
            StoredVersionText);
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}
