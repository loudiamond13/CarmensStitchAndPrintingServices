using Csps.Domain.Common;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>ORD-16, ORD-17, D-02 to D-07, D-10, D-36, D-38: the order applies the owner's status table to its own balance, records every move and locks itself in the two end states.</summary>
public sealed class OrderStatusTests
{
    private const string LockedCode = "orders.locked";
    private static readonly DateTimeOffset Created = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = new(2026, 10, 29, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 28);
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid Cash = Guid.Parse("01a17fce-7806-77e1-91b7-d3b852f2fd1d");
    private static readonly Guid Fabric = Guid.Parse("01a17fce-780b-75d1-89e0-5b3b9b185a2c");
    private static readonly Guid Ink = Guid.Parse("01a17fce-780c-73e0-b847-33f866e42d3d");
    private static readonly Guid Admin = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid Manager = Guid.Parse("2f9a6d10-58b3-4c7e-8a41-d03e7b95c628");

    [Fact]
    public void CompletingWhileMoneyIsOwedIsRefusedAndChangesNothing()
    {
        var order = FullOrder(paid: 12000.00m);
        var editVersion = order.EditVersion;

        var result = order.ChangeStatus(OrderStatus.Completed, Admin, Later);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Code.ShouldBe("orders.complete-balance-owed");
        result.Error.Message.ShouldBe("This order still has ₱9,327.50 to pay. Record the payment first.");
        AssertUnmoved(order, OrderStatus.Pending, editVersion);
    }

    [Fact]
    public void CompletingWithACustomerCreditIsRefusedAndChangesNothing()
    {
        var order = FullOrder(paid: 21327.50m);
        order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 100.00m, "Late delivery"), Created).IsSuccess.ShouldBeTrue();
        order.CustomerCredit.ShouldBe(100.00m);
        var editVersion = order.EditVersion;

        var result = order.ChangeStatus(OrderStatus.Completed, Admin, Later);

        result.Error.Code.ShouldBe("orders.complete-credit");
        result.Error.Message.ShouldBe("This order has a customer credit of ₱100.00. Record a refund first.");
        AssertUnmoved(order, OrderStatus.Pending, editVersion);
    }

    [Fact]
    public void CompletingAtAZeroBalanceMovesTheOrderAndRecordsTheMove()
    {
        var order = FullOrder(paid: 21327.50m);
        var editVersion = order.EditVersion;

        var result = order.ChangeStatus(OrderStatus.Completed, Admin, Later);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(OrderStatusMove.Move);
        order.Status.ShouldBe(OrderStatus.Completed);
        order.StatusChangedAtUtc.ShouldBe(Later);
        order.EditVersion.ShouldNotBe(editVersion);
        order.Balance.ShouldBe(0m);
        var row = order.StatusChanges.Single(change => change.ToStatus == OrderStatus.Completed);
        row.FromStatus.ShouldBe(OrderStatus.Pending);
        row.ChangedById.ShouldBe(Admin);
        row.ChangedAtUtc.ShouldBe(Later);
        row.OrderId.ShouldBe(order.Id);
        row.Order.ShouldBeSameAs(order);
        order.StatusChanges.Count.ShouldBe(2);
    }

    [Fact]
    public void EveryMoveAmongTheActiveStatusesAddsOneHistoryRowInOrder()
    {
        var order = FullOrder(paid: 0m);

        foreach (var next in new[] { OrderStatus.Mockup, OrderStatus.InProduction, OrderStatus.Ready, OrderStatus.Delivered, OrderStatus.Pending })
        {
            order.ChangeStatus(next, Manager, Later).Value.ShouldBe(OrderStatusMove.Move);
        }

        order.StatusChanges.Select(static change => (change.FromStatus, change.ToStatus)).ShouldBe(
        [
            (null, OrderStatus.Pending),
            (OrderStatus.Pending, OrderStatus.Mockup),
            (OrderStatus.Mockup, OrderStatus.InProduction),
            (OrderStatus.InProduction, OrderStatus.Ready),
            (OrderStatus.Ready, OrderStatus.Delivered),
            (OrderStatus.Delivered, OrderStatus.Pending),
        ]);
    }

    [Fact]
    public void AskingForTheStatusTheOrderAlreadyHasChangesNothingAtAll()
    {
        var order = FullOrder(paid: 0m);
        var editVersion = order.EditVersion;

        var result = order.ChangeStatus(OrderStatus.Pending, Admin, Later);

        result.Value.ShouldBe(OrderStatusMove.NoChange);
        AssertUnmoved(order, OrderStatus.Pending, editVersion);
        order.StatusChangedAtUtc.ShouldBe(Created);
    }

    [Fact]
    public void ReopeningACompletedOrderMovesItToAnActiveStatusAndRecordsItAndUnlocksIt()
    {
        var order = FullOrder(paid: 21327.50m);
        order.ChangeStatus(OrderStatus.Completed, Admin, Later).IsSuccess.ShouldBeTrue();
        order.AddItem(new NewOrderItem(JerseyType, "Locked add", null, 1, 100m), Later).Error.Code.ShouldBe(LockedCode);

        var result = order.ChangeStatus(OrderStatus.Ready, Manager, Later.AddHours(1));

        result.Value.ShouldBe(OrderStatusMove.Reopen);
        order.Status.ShouldBe(OrderStatus.Ready);
        order.StatusChangedAtUtc.ShouldBe(Later.AddHours(1));
        var row = order.StatusChanges[^1];
        row.FromStatus.ShouldBe(OrderStatus.Completed);
        row.ToStatus.ShouldBe(OrderStatus.Ready);
        row.ChangedById.ShouldBe(Manager);
        order.AddItem(new NewOrderItem(JerseyType, "Open again", null, 1, 100m), Later.AddHours(1)).IsSuccess.ShouldBeTrue();
    }

    [Theory]
    [InlineData(OrderStatus.Completed, OrderStatus.Cancelled, "orders.reopen-first", "Reopen the order first, then cancel it.")]
    [InlineData(OrderStatus.Cancelled, OrderStatus.Completed, "orders.reopen-first", "Reopen the order first, then mark it Completed.")]
    public void GoingStraightFromOneEndStateToTheOtherIsRefusedUntilTheOrderIsReopened(OrderStatus from, OrderStatus to, string code, string message)
    {
        var order = FullOrder(paid: 21327.50m);
        order.ChangeStatus(OrderStatus.Completed, Admin, Later).IsSuccess.ShouldBeTrue();
        if (from == OrderStatus.Cancelled)
        {
            order.ChangeStatus(OrderStatus.Ready, Admin, Later).IsSuccess.ShouldBeTrue();
            order.ChangeStatus(OrderStatus.Cancelled, Admin, Later).IsSuccess.ShouldBeTrue();
        }

        var editVersion = order.EditVersion;
        var rows = order.StatusChanges.Count;

        var result = order.ChangeStatus(to, Admin, Later.AddHours(2));

        result.Error.Code.ShouldBe(code);
        result.Error.Message.ShouldBe(message);
        order.Status.ShouldBe(from);
        order.EditVersion.ShouldBe(editVersion);
        order.StatusChanges.Count.ShouldBe(rows);
    }

    [Fact]
    public void AnUnknownStatusNumberIsAProgrammingError()
    {
        var order = FullOrder(paid: 0m);

        Should.Throw<ArgumentOutOfRangeException>(() => order.ChangeStatus((OrderStatus)99, Admin, Later));
    }

    [Fact]
    public void CancellingOrd0148KeepsTheCashAndTheCostsAndReopeningRestoresTheProfit()
    {
        var order = FullOrder(paid: 12000.00m);
        order.Profit.ShouldBe(15262.50m);

        order.ChangeStatus(OrderStatus.Cancelled, Admin, Later).Value.ShouldBe(OrderStatusMove.Move);

        order.PaidTotal.ShouldBe(12000.00m);
        order.RefundedTotal.ShouldBe(0m);
        order.ExpensesTotal.ShouldBe(6065.00m);
        order.Profit.ShouldBe(5935.00m);
        order.Payments.Sum(static payment => payment.Amount).ShouldBe(12000.00m);
        order.Expenses.Sum(static expense => expense.Amount).ShouldBe(6065.00m);

        order.ChangeStatus(OrderStatus.Pending, Manager, Later.AddHours(1)).Value.ShouldBe(OrderStatusMove.Reopen);

        order.Profit.ShouldBe(15262.50m);
        order.PaidTotal.ShouldBe(12000.00m);
        order.ExpensesTotal.ShouldBe(6065.00m);
        order.Balance.ShouldBe(9327.50m);
    }

    [Fact]
    public void CancellingFromAnyActiveStatusIsAllowedWhateverIsOwed()
    {
        foreach (var status in OrderStatusRules.ActiveStatuses)
        {
            var order = FullOrder(paid: 100m);
            order.ChangeStatus(status, Admin, Later).IsSuccess.ShouldBeTrue();

            order.ChangeStatus(OrderStatus.Cancelled, Admin, Later.AddHours(1)).Value.ShouldBe(OrderStatusMove.Move);
            order.Status.ShouldBe(OrderStatus.Cancelled);
        }
    }

    [Theory]
    [InlineData(OrderStatus.Completed, "This order is completed. Reopen it to make changes.")]
    [InlineData(OrderStatus.Cancelled, "This order is cancelled. Reopen it to make changes.")]
    public void EveryChangeToAnOrderInAnEndStateIsRefusedWithTheLockedErrorAndChangesNothing(OrderStatus endState, string message)
    {
        var order = FullOrder(paid: 21327.50m);
        var itemId = order.Items[0].Id;
        var discountId = order.Discounts[0].Id;
        var paymentId = order.Payments[0].Id;
        var expenseId = order.Expenses[0].Id;
        var details = new OrderDetails("Maria Santos", null, "0917 123 4567", null, null, Today, Today.AddDays(14), "New notes");
        var item = new NewOrderItem(JerseyType, "Changed", null, 1, 100m);
        var discount = new NewOrderDiscount(DiscountKind.Fixed, 10m, "Changed");
        var payment = new NewOrderPayment(Today, 1m, Cash, null, null, Admin);
        var expense = new NewOrderExpense(Today, 1m, Ink, null, Admin);
        order.ChangeStatus(endState, Admin, Later).IsSuccess.ShouldBeTrue();
        var before = Snapshot(order);

        var refusals = new (string Name, Error? Error)[]
        {
            ("UpdateDetails", Refusal(order.UpdateDetails(details, Later))),
            ("AddItem", Refusal(order.AddItem(item, Later))),
            ("UpdateItem", Refusal(order.UpdateItem(itemId, item, Later))),
            ("RemoveItem", Refusal(order.RemoveItem(itemId, Later))),
            ("AddDiscount", Refusal(order.AddDiscount(discount, Later))),
            ("UpdateDiscount", Refusal(order.UpdateDiscount(discountId, discount, Later))),
            ("RemoveDiscount", Refusal(order.RemoveDiscount(discountId, Later))),
            ("AddPayment", Refusal(order.AddPayment(payment, Today, Later))),
            ("UpdatePayment", Refusal(order.UpdatePayment(paymentId, payment, Today, Later))),
            ("RemovePayment", Refusal(order.RemovePayment(paymentId, Later))),
            ("AddExpense", Refusal(order.AddExpense(expense, Today, Later))),
            ("UpdateExpense", Refusal(order.UpdateExpense(expenseId, expense, Today, Later))),
            ("RemoveExpense", Refusal(order.RemoveExpense(expenseId, Later))),
        };

        foreach (var (name, error) in refusals)
        {
            error.ShouldNotBeNull(name);
            error.Kind.ShouldBe(ErrorKind.BusinessRule, name);
            error.Code.ShouldBe(LockedCode, name);
            error.Message.ShouldBe(message, name);
        }

        Snapshot(order).ShouldBe(before);
    }

    [Fact]
    public void ALockedOrderRefusesAnEditToAnIdItDoesNotHaveWithTheLockedErrorNotANotFound()
    {
        var order = FullOrder(paid: 21327.50m);
        order.ChangeStatus(OrderStatus.Completed, Admin, Later).IsSuccess.ShouldBeTrue();

        order.RemoveItem(Guid.NewGuid(), Later).Error.Code.ShouldBe(LockedCode);
        order.UpdatePayment(Guid.NewGuid(), new NewOrderPayment(Today, 1m, Cash, null, null, Admin), Today, Later).Error.Code.ShouldBe(LockedCode);
    }

    [Fact]
    public void TheLockMessageNamesTheStatus()
    {
        OrderRules.Locked(OrderStatus.Completed).ShouldBe("This order is completed. Reopen it to make changes.");
        OrderRules.Locked(OrderStatus.Cancelled).ShouldBe("This order is cancelled. Reopen it to make changes.");
        OrderRules.LockedCode.ShouldBe(LockedCode);
    }

    private static Error? Refusal<T>(Result<T> result) => result.IsFailure ? result.Error : null;

    private static void AssertUnmoved(Order order, OrderStatus status, Guid editVersion)
    {
        order.Status.ShouldBe(status);
        order.EditVersion.ShouldBe(editVersion);
        order.StatusChanges.Count.ShouldBe(1);
    }

    private static string Snapshot(Order order) => string.Join(
        '|',
        order.EditVersion,
        order.Status,
        order.CustomerName,
        order.Notes,
        order.Totals,
        string.Join(',', order.Items.Select(static item => $"{item.Id}:{item.Description}:{item.Quantity}:{item.UnitPrice}")),
        string.Join(',', order.Discounts.Select(static discount => $"{discount.Id}:{discount.Value}:{discount.Reason}")),
        string.Join(',', order.Payments.Select(static payment => $"{payment.Id}:{payment.Amount}")),
        string.Join(',', order.Expenses.Select(static expense => $"{expense.Id}:{expense.Amount}")),
        order.StatusChanges.Count);

    // ORD-2026-0148: five items (22,450.00), a 5% discount, expenses of 6,065.00 and the given payments.
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
