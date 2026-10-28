using Csps.Domain.Common;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>ORD-05, ORD-18, D-05, D-07, D-09, D-13, D-30, D-34 to D-36: refunds are allowed only where the owner said, stay within their caps and are the one write a cancelled order accepts.</summary>
public sealed class OrderRefundTests
{
    private static readonly DateTimeOffset Created = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = new(2026, 10, 29, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 28);
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid Cash = Guid.Parse("01a17fce-7806-77e1-91b7-d3b852f2fd1d");
    private static readonly Guid Fabric = Guid.Parse("01a17fce-780b-75d1-89e0-5b3b9b185a2c");
    private static readonly Guid Ink = Guid.Parse("01a17fce-780c-73e0-b847-33f866e42d3d");
    private static readonly Guid Admin = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid Manager = Guid.Parse("2f9a6d10-58b3-4c7e-8a41-d03e7b95c628");

    private static readonly (string Path, string Message, NewOrderRefund Refund)[] BrokenRefunds =
    [
        ("refundDate", OrderRules.RefundDateInFuture, new NewOrderRefund(Today.AddDays(1), 100m, "Cancelled", Manager)),
        ("amount", OrderRules.PaymentAmountOutOfRange, new NewOrderRefund(Today, 0m, "Cancelled", Manager)),
        ("amount", OrderRules.PaymentAmountOutOfRange, new NewOrderRefund(Today, -1m, "Cancelled", Manager)),
        ("amount", OrderRules.PaymentAmountOutOfRange, new NewOrderRefund(Today, 1_000_000.01m, "Cancelled", Manager)),
        ("amount", OrderRules.MoneyDecimals, new NewOrderRefund(Today, 0.001m, "Cancelled", Manager)),
        ("reason", OrderRules.RefundReasonRequired, new NewOrderRefund(Today, 100m, string.Empty, Manager)),
        ("reason", OrderRules.RefundReasonRequired, new NewOrderRefund(Today, 100m, "   ", Manager)),
        ("reason", OrderRules.RefundReasonTooLong, new NewOrderRefund(Today, 100m, new string('r', 201), Manager)),
        ("refundedByUserId", OrderRules.RefundedByRequired, new NewOrderRefund(Today, 100m, "Cancelled", Guid.Empty)),
    ];

    [Fact]
    public void AnActiveOrderWithNoCreditRefusesARefundWithTheNotAllowedError()
    {
        var order = FullOrder(paid: 12000.00m);
        var before = Snapshot(order);

        var result = order.AddRefund(Refund(100m), Today, Later);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Code.ShouldBe("orders.refund-not-allowed");
        result.Error.Message.ShouldBe("A refund can be recorded only on a cancelled order or one with a customer credit.");
        Snapshot(order).ShouldBe(before);
    }

    [Fact]
    public void OnAnActiveOrderInCreditTheCreditIsAcceptedOneCentavoMoreIsRefusedAndTheCreditThenClears()
    {
        var order = OrderInCredit(500.00m);
        var before = Snapshot(order);

        var over = order.AddRefund(Refund(500.01m), Today, Later);

        over.Error.Kind.ShouldBe(ErrorKind.Validation);
        over.Error.FieldErrors.ShouldNotBeNull()["amount"].ShouldBe(["This is more than the customer credit. Enter ₱500.00 or less."]);
        Snapshot(order).ShouldBe(before);

        var exact = order.AddRefund(Refund(500.00m), Today, Later);

        exact.IsSuccess.ShouldBeTrue();
        order.RefundedTotal.ShouldBe(500.00m);
        order.CustomerCredit.ShouldBe(0.00m);
        order.Balance.ShouldBe(0.00m);
    }

    [Fact]
    public void ARefundedCreditLetsTheOrderBeMarkedCompleted()
    {
        var order = OrderInCredit(500.00m);
        order.ChangeStatus(OrderStatus.Completed, Admin, Later).Error.Code.ShouldBe("orders.complete-credit");

        order.AddRefund(Refund(500.00m), Today, Later).IsSuccess.ShouldBeTrue();
        var completed = order.ChangeStatus(OrderStatus.Completed, Admin, Later);

        completed.IsSuccess.ShouldBeTrue();
        order.Status.ShouldBe(OrderStatus.Completed);
    }

    [Fact]
    public void ACancelledOrderAcceptsWhatWasPaidAndRefusesOneCentavoMoreWithTheKeptMessage()
    {
        var order = CancelledOrder(paid: 12000.00m);

        var over = order.AddRefund(Refund(12000.01m), Today, Later);
        var exact = order.AddRefund(Refund(12000.00m), Today, Later);

        over.Error.Kind.ShouldBe(ErrorKind.Validation);
        over.Error.FieldErrors.ShouldNotBeNull()["amount"].ShouldBe(["This is more than was paid and not yet refunded. Enter ₱12,000.00 or less."]);
        exact.IsSuccess.ShouldBeTrue();
        order.Status.ShouldBe(OrderStatus.Cancelled);
        order.RefundedTotal.ShouldBe(12000.00m);
    }

    [Fact]
    public void ACancelledOrdersSecondRefundIsCappedAtWhatIsLeftAndAFullyRefundedOrderSaysSo()
    {
        var order = CancelledOrder(paid: 12000.00m);
        order.AddRefund(Refund(7000.00m), Today, Later).IsSuccess.ShouldBeTrue();

        var over = order.AddRefund(Refund(5000.01m), Today, Later);
        var rest = order.AddRefund(Refund(5000.00m), Today, Later);
        var none = order.AddRefund(Refund(0.01m), Today, Later);

        over.Error.FieldErrors.ShouldNotBeNull()["amount"].ShouldBe(["This is more than was paid and not yet refunded. Enter ₱5,000.00 or less."]);
        rest.IsSuccess.ShouldBeTrue();
        none.Error.FieldErrors.ShouldNotBeNull()["amount"].ShouldBe(["Everything that was paid has already been refunded."]);
        order.Refunds.Count.ShouldBe(2);
        order.Refunds[1].Position.ShouldBe(1);
    }

    [Fact]
    public void ACancelledOrderRefundedInFullShowsALossOfItsExpenses()
    {
        var order = CancelledOrder(paid: 12000.00m);
        order.Profit.ShouldBe(5935.00m);

        order.AddRefund(Refund(12000.00m), Today, Later).IsSuccess.ShouldBeTrue();

        order.PaidTotal.ShouldBe(12000.00m);
        order.RefundedTotal.ShouldBe(12000.00m);
        order.ExpensesTotal.ShouldBe(6065.00m);
        order.Profit.ShouldBe(-6065.00m);
        order.Balance.ShouldBe(21327.50m);
        order.CustomerCredit.ShouldBe(0.00m);
    }

    [Fact]
    public void AnEditMayRaiseARefundUpToTheCapPlusItsOwnOldAmountAndNoFurther()
    {
        var order = CancelledOrder(paid: 12000.00m);
        var seven = order.AddRefund(Refund(7000.00m), Today, Later).Value;
        var three = order.AddRefund(Refund(3000.00m), Today, Later).Value;

        var over = order.UpdateRefund(three.Id, Refund(5000.01m), Today, Later);
        var exact = order.UpdateRefund(three.Id, Refund(5000.00m), Today, Later);

        over.Error.FieldErrors.ShouldNotBeNull()["amount"].ShouldBe(["This is more than was paid and not yet refunded. Enter ₱5,000.00 or less."]);
        exact.IsSuccess.ShouldBeTrue();
        exact.Value.Amount.ShouldNotBeNull().To.ShouldBe(5000.00m);
        order.RefundedTotal.ShouldBe(12000.00m);
        order.Refunds.Single(refund => refund.Id == seven.Id).Amount.ShouldBe(7000.00m);
    }

    [Fact]
    public void AnEditOnAnActiveOrderIsCappedAtTheCreditPlusTheRefundsOldAmountAndMayBeLowered()
    {
        var order = OrderInCredit(500.00m);
        var refund = order.AddRefund(Refund(300.00m), Today, Later).Value;
        order.CustomerCredit.ShouldBe(200.00m);

        var over = order.UpdateRefund(refund.Id, Refund(500.01m), Today, Later);
        var exact = order.UpdateRefund(refund.Id, Refund(500.00m), Today, Later);

        over.Error.FieldErrors.ShouldNotBeNull()["amount"].ShouldBe(["This is more than the customer credit. Enter ₱500.00 or less."]);
        exact.IsSuccess.ShouldBeTrue();
        order.CustomerCredit.ShouldBe(0.00m);

        var lowered = order.UpdateRefund(refund.Id, Refund(100.00m), Today, Later);

        lowered.IsSuccess.ShouldBeTrue();
        order.CustomerCredit.ShouldBe(400.00m);
    }

    [Fact]
    public void AnEditReportsEachChangeAndTheRefunderApartAndAnIdenticalEditChangesNothing()
    {
        var order = CancelledOrder(paid: 12000.00m);
        var refund = order.AddRefund(Refund(1000.00m), Today, Later).Value;
        var editVersion = order.EditVersion;

        var same = order.UpdateRefund(refund.Id, Refund(1000.00m), Today, Later);

        same.IsSuccess.ShouldBeTrue();
        same.Value.HasAny.ShouldBeFalse();
        order.EditVersion.ShouldBe(editVersion);

        var changed = order.UpdateRefund(refund.Id, new NewOrderRefund(Today.AddDays(-1), 900.00m, "  Changed mind  ", Admin), Today, Later);

        changed.IsSuccess.ShouldBeTrue();
        changed.Value.Date.ShouldNotBeNull().From.ShouldBe(Today);
        changed.Value.Amount.ShouldNotBeNull().To.ShouldBe(900.00m);
        changed.Value.ReasonChanged.ShouldBeTrue();
        changed.Value.Refunder.ShouldNotBeNull().To.ShouldBe(Admin);
        changed.Value.HasFieldChange.ShouldBeTrue();
        refund.Reason.ShouldBe("Changed mind");
        order.EditVersion.ShouldNotBe(editVersion);

        var onlyRefunder = order.UpdateRefund(refund.Id, new NewOrderRefund(Today.AddDays(-1), 900.00m, "Changed mind", Manager), Today, Later);

        onlyRefunder.Value.HasFieldChange.ShouldBeFalse();
        onlyRefunder.Value.HasAny.ShouldBeTrue();
        onlyRefunder.Value.Refunder.ShouldNotBeNull().From.ShouldBe(Admin);
    }

    [Fact]
    public void ARefundOnACancelledOrderCanBeEditedAndRemovedWithoutReopeningWhileEveryOtherWriteStaysLocked()
    {
        var order = CancelledOrder(paid: 12000.00m);
        var refund = order.AddRefund(Refund(4000.00m), Today, Later).Value;

        var edited = order.UpdateRefund(refund.Id, Refund(2500.00m), Today, Later);
        var removed = order.RemoveRefund(refund.Id, Later);
        var itemRefused = order.AddItem(new NewOrderItem(JerseyType, "Late item", null, 1, 100m), Later);
        var paymentRefused = order.AddPayment(new NewOrderPayment(Today, 1m, Cash, null, null, Admin), Today, Later);

        edited.IsSuccess.ShouldBeTrue();
        removed.IsSuccess.ShouldBeTrue();
        removed.Value.Id.ShouldBe(refund.Id);
        order.Refunds.ShouldBeEmpty();
        order.RefundedTotal.ShouldBe(0.00m);
        order.Profit.ShouldBe(5935.00m);
        order.Status.ShouldBe(OrderStatus.Cancelled);
        itemRefused.Error.Code.ShouldBe("orders.locked");
        paymentRefused.Error.Code.ShouldBe("orders.locked");
    }

    [Fact]
    public void EveryRefundWriteOnACompletedOrderIsRefusedWithTheLockedErrorAndChangesNothing()
    {
        var order = OrderInCredit(500.00m);
        var refund = order.AddRefund(Refund(500.00m), Today, Later).Value;
        order.ChangeStatus(OrderStatus.Completed, Admin, Later).IsSuccess.ShouldBeTrue();
        var before = Snapshot(order);

        var refusals = new (string Name, Error? Error)[]
        {
            ("AddRefund", Refusal(order.AddRefund(Refund(1m), Today, Later))),
            ("UpdateRefund", Refusal(order.UpdateRefund(refund.Id, Refund(1m), Today, Later))),
            ("RemoveRefund", Refusal(order.RemoveRefund(refund.Id, Later))),
            ("UpdateRefund with an unknown id", Refusal(order.UpdateRefund(Guid.NewGuid(), Refund(1m), Today, Later))),
        };

        foreach (var (name, error) in refusals)
        {
            error.ShouldNotBeNull(name);
            error.Kind.ShouldBe(ErrorKind.BusinessRule, name);
            error.Code.ShouldBe("orders.locked", name);
            error.Message.ShouldBe("This order is completed. Reopen it to make changes.", name);
        }

        Snapshot(order).ShouldBe(before);
    }

    [Fact]
    public void AnIdThatIsNotOnTheOrderIsA404ForAnEditAndARemoval()
    {
        var order = CancelledOrder(paid: 12000.00m);

        var edit = order.UpdateRefund(Guid.NewGuid(), Refund(1m), Today, Later);
        var remove = order.RemoveRefund(Guid.NewGuid(), Later);

        edit.Error.Kind.ShouldBe(ErrorKind.NotFound);
        edit.Error.Code.ShouldBe("orders.refund-not-found");
        edit.Error.Message.ShouldBe("This refund was not found on this order.");
        remove.Error.Code.ShouldBe("orders.refund-not-found");
    }

    [Fact]
    public void EveryBrokenRefundFieldIsRefusedUnderItsOwnNameAndNothingChanges()
    {
        var order = CancelledOrder(paid: 12000.00m);
        var before = Snapshot(order);

        foreach (var (path, message, refund) in BrokenRefunds)
        {
            var result = order.AddRefund(refund, Today, Later);

            result.IsFailure.ShouldBeTrue(path);
            result.Error.Kind.ShouldBe(ErrorKind.Validation, path);
            var fields = result.Error.FieldErrors.ShouldNotBeNull();
            fields.Keys.ShouldBe([path]);
            fields[path].ShouldBe([message], path);
        }

        Snapshot(order).ShouldBe(before);
    }

    [Fact]
    public void AnEditWithABrokenFieldIsRefusedUnderItsOwnNameAndChangesNothing()
    {
        var order = CancelledOrder(paid: 12000.00m);
        var refund = order.AddRefund(Refund(1000.00m), Today, Later).Value;
        var before = Snapshot(order);

        foreach (var (path, message, broken) in BrokenRefunds)
        {
            var result = order.UpdateRefund(refund.Id, broken, Today, Later);

            result.IsFailure.ShouldBeTrue(path);
            result.Error.Kind.ShouldBe(ErrorKind.Validation, path);
            result.Error.FieldErrors.ShouldNotBeNull()[path].ShouldBe([message], path);
        }

        Snapshot(order).ShouldBe(before);
    }

    [Fact]
    public void ARefundDatedTodayIsAcceptedAndTheReasonIsTrimmed()
    {
        var order = CancelledOrder(paid: 12000.00m);

        var result = order.AddRefund(new NewOrderRefund(Today, 100m, "  Order cancelled by the team  ", Manager), Today, Later);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Reason.ShouldBe("Order cancelled by the team");
        result.Value.RefundDate.ShouldBe(Today);
        result.Value.RefundedByUserId.ShouldBe(Manager);
        result.Value.OrderId.ShouldBe(order.Id);
        result.Value.Order.ShouldBeSameAs(order);
    }

    [Fact]
    public void AReasonOfExactlyTwoHundredCharactersIsAcceptedAndTheFiftyFirstRefundIsRefused()
    {
        var order = CancelledOrder(paid: 12000.00m);
        order.AddRefund(new NewOrderRefund(Today, 0.01m, new string('r', 200), Manager), Today, Later).IsSuccess.ShouldBeTrue();

        for (var count = 1; count < OrderRules.MaxRefunds; count++)
        {
            order.AddRefund(Refund(0.01m), Today, Later).IsSuccess.ShouldBeTrue();
        }

        var fifty = order.Refunds.Count;
        var result = order.AddRefund(Refund(0.01m), Today, Later);

        fifty.ShouldBe(50);
        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Code.ShouldBe("orders.too-many-refunds");
        result.Error.Message.ShouldBe("An order can have at most 50 refunds.");
        order.Refunds.Count.ShouldBe(50);
    }

    [Fact]
    public void ARefundBringsTheStoredFiguresInLineWithOrderMath()
    {
        var order = CancelledOrder(paid: 12000.00m);
        order.AddRefund(Refund(2500.00m), Today, Later).IsSuccess.ShouldBeTrue();

        var figures = OrderMath.Compute(
            [.. order.Items.Select(static item => new OrderMathItem(item.Quantity, item.UnitPrice))],
            [.. order.Discounts.Select(static discount => new OrderMathDiscount(discount.Kind, discount.Value))],
            [.. order.Payments.Select(static payment => payment.Amount)],
            [.. order.Refunds.Select(static refund => refund.Amount)],
            [.. order.Expenses.Select(static expense => expense.Amount)],
            cancelled: true);

        order.Totals.ShouldBe(new OrderTotals(figures.Subtotal, figures.Discount, figures.Total, figures.Paid, figures.Refunded, figures.Balance, figures.CustomerCredit, figures.Expenses, figures.Profit, figures.FullyPaid));
    }

    private static NewOrderRefund Refund(decimal amount) => new(Today, amount, "Order cancelled by the team", Manager);

    private static Error? Refusal<T>(Result<T> result) => result.IsFailure ? result.Error : null;

    private static string Snapshot(Order order) => string.Join(
        '|',
        order.EditVersion,
        order.Status,
        order.Totals,
        string.Join(',', order.Refunds.Select(static refund => $"{refund.Id}:{refund.Amount}:{refund.Reason}:{refund.RefundedByUserId}")),
        order.StatusChanges.Count);

    // ORD-2026-0148 cancelled: paid 12,000.00 against expenses of 6,065.00.
    private static Order CancelledOrder(decimal paid)
    {
        var order = FullOrder(paid);
        order.ChangeStatus(OrderStatus.Cancelled, Admin, Later).IsSuccess.ShouldBeTrue();
        return order;
    }

    // ORD-2026-0148 paid in full, then a fixed discount of the given amount leaves that much customer credit.
    private static Order OrderInCredit(decimal credit)
    {
        var order = FullOrder(paid: 21327.50m);
        order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, credit, "Late delivery"), Created).IsSuccess.ShouldBeTrue();
        order.CustomerCredit.ShouldBe(credit);
        return order;
    }

    private static Order FullOrder(decimal paid)
    {
        var details = new OrderDetails("Juan Dela Cruz", "Brgy. San Roque Ballers", "0917 123 4567", "juan.dc@example.com", null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null);
        var items = new[]
        {
            new NewOrderItem(JerseyType, "Jersey top", "S-XL", 15, 650.00m),
            new NewOrderItem(JerseyType, "Jersey shorts", "S-XL", 15, 300.00m),
            new NewOrderItem(JerseyType, "Coach polo", "L", 2, 550.00m),
            new NewOrderItem(JerseyType, "Warm-up long sleeves", "M-XL", 15, 420.00m),
            new NewOrderItem(JerseyType, "Team banner", null, 1, 800.00m),
        };
        var payments = paid > 0m ? new[] { new NewOrderPayment(Today, paid, Cash, null, null, Admin) } : [];
        var expenses = new[]
        {
            new NewOrderExpense(Today.AddDays(-6), 3825.00m, Fabric, "Dri-fit mesh", Manager),
            new NewOrderExpense(Today.AddDays(-5), 1640.00m, Ink, "Ink and paper", Admin),
            new NewOrderExpense(Today.AddDays(-3), 600.00m, Ink, "Embroidery", Admin),
        };
        var discounts = new[] { new NewOrderDiscount(DiscountKind.Percentage, 5m, "Barangay league discount") };
        var input = new NewOrder(details, OrderStatus.Pending, items) { Discounts = discounts, Payments = payments, Expenses = expenses };
        return Order.Create(input, Admin, Created, Today).Value;
    }
}
