using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Domain.Auditing;
using Csps.Domain.Expenses;
using Csps.Domain.Orders;

namespace Csps.Application.UnitTests.Orders;

/// <summary>D-31, 05 D-40, T-07-12: the order.created detail holds the number, status, dates, item count and total, and never customer text.</summary>
public sealed class OrderAuditDetailTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly Guid Method = Guid.Parse("01a17fce-7806-77e1-91b7-d3b852f2fd1d");
    private static readonly Guid OtherMethod = Guid.Parse("01a17fce-7807-751a-bb7b-3719f2840928");
    private static readonly Guid Receiver = Guid.Parse("2f9a6d10-58b3-4c7e-8a41-d03e7b95c628");
    private static readonly Guid OtherReceiver = Guid.Parse("a41d7c92-0b58-4e3f-96d1-8c2e5f7a3b04");
    private static readonly Guid Category = Guid.Parse("01a17fce-780b-75d1-89e0-5b3b9b185a2c");
    private static readonly Guid OtherCategory = Guid.Parse("01a17fce-780c-73e0-b847-33f866e42d3d");

    [Fact]
    public void CreatedHoldsExactlyTheDocumentedKeysInOrder()
    {
        var order = NewOrder("ORD-2026-0001");

        var detail = OrderAuditDetail.Created(order);

        detail.ShouldBe("number=ORD-2026-0001;status=pending;orderDate=2026-10-28;dueDate=2026-11-11;items=1;total=9750.00");
        detail.Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void CreatedNamesTheStatusByItsWireKeyAndCountsEveryItem()
    {
        var items = new[]
        {
            new NewOrderItem(Guid.NewGuid(), "Jersey top", null, 15, 650.00m),
            new NewOrderItem(Guid.NewGuid(), "Banner", null, 1, 800.00m),
        };
        var order = Order.Create(new NewOrder(Details(), OrderStatus.InProduction, items), Guid.NewGuid(), Now).Value;
        order.AssignNumber("ORD-2026-0148");

        OrderAuditDetail.Created(order).ShouldBe("number=ORD-2026-0148;status=production;orderDate=2026-10-28;dueDate=2026-11-11;items=2;total=10550.00");
    }

    [Fact]
    public void CreatedHoldsNoCustomerTeamContactEmailAddressOrNotesText()
    {
        var order = NewOrder("ORD-2026-0001");

        var detail = OrderAuditDetail.Created(order);

        foreach (var secret in new[] { "Juan", "Dela Cruz", "Ballers", "0917", "juan.dc", "Brgy.", "rush", "Jersey top" })
        {
            detail.ShouldNotContain(secret, Case.Insensitive);
        }
    }

    [Fact]
    public void ANullOrderIsAProgrammingError() => Should.Throw<ArgumentNullException>(() => OrderAuditDetail.Created(null!));

    [Fact]
    public void DetailsChangedNamesTheDueDatePairAndTheChangedFieldsButNoText()
    {
        var changes = new OrderDetailsChanges(null, new DueDateChange(new DateOnly(2026, 11, 11), new DateOnly(2026, 11, 18)), ["customerName", "notes"]);

        var detail = OrderAuditDetail.DetailsChanged(changes);

        detail.ShouldBe("dueDate=2026-11-11>2026-11-18;fields=customerName,notes");
        detail.Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void DetailsChangedWritesTheOrderDateBeforeTheDueDate()
    {
        var changes = new OrderDetailsChanges(
            new ValueChange<DateOnly>(new DateOnly(2026, 10, 28), new DateOnly(2026, 10, 26)),
            new DueDateChange(new DateOnly(2026, 11, 11), new DateOnly(2026, 11, 18)),
            []);

        OrderAuditDetail.DetailsChanged(changes).ShouldBe("orderDate=2026-10-28>2026-10-26;dueDate=2026-11-11>2026-11-18");
    }

    [Fact]
    public void DetailsChangedLeavesTheOldDueDateEmptyWhenAnImportedOrderHadNone()
    {
        var changes = new OrderDetailsChanges(null, new DueDateChange(null, new DateOnly(2026, 11, 18)), []);

        OrderAuditDetail.DetailsChanged(changes).ShouldBe("dueDate=>2026-11-18");
    }

    [Fact]
    public void DetailsChangedWithOnlyFieldsHasNoDates()
    {
        var changes = new OrderDetailsChanges(null, null, ["email"]);

        OrderAuditDetail.DetailsChanged(changes).ShouldBe("fields=email");
    }

    [Fact]
    public void DetailsChangedHoldsNoCustomerTeamContactEmailAddressOrNotesText()
    {
        var order = NewOrder("ORD-2026-0001");
        var changes = order.UpdateDetails(
            Details() with { CustomerName = "Maria Santos", TeamName = "Riders", ContactNumber = "0918 555 0101", Email = "maria@example.com", Address = "Quezon City", Notes = "call first" },
            Now.AddDays(1)).Value;

        var detail = OrderAuditDetail.DetailsChanged(changes);

        detail.ShouldBe("fields=customerName,teamName,contactNumber,email,address,notes");
        foreach (var secret in new[] { "Maria", "Santos", "Riders", "0918", "maria@", "Quezon", "call first" })
        {
            detail.ShouldNotContain(secret, Case.Insensitive);
        }
    }

    [Fact]
    public void NullDetailsChangesAreAProgrammingError() => Should.Throw<ArgumentNullException>(() => OrderAuditDetail.DetailsChanged(null!));

    [Fact]
    public void ItemAddedAndRemovedHoldTheItemIdProductTypeQuantityAndUnitPriceOnly()
    {
        var order = NewOrder("ORD-2026-0001");
        var typeId = Guid.Parse("01a17fce-7801-7e45-b875-357767854eda");
        var item = order.AddItem(new NewOrderItem(typeId, "Private description", "Private size", 2, 550.00m), Now.AddDays(1)).Value;
        var expected = $"item={item.Id:D};productType={typeId:D};quantity=2;unitPrice=550.00";

        OrderAuditDetail.ItemAdded(item).ShouldBe(expected);
        OrderAuditDetail.ItemRemoved(item).ShouldBe(expected);
        OrderAuditDetail.ItemAdded(item).ShouldNotContain("Private", Case.Insensitive);
        OrderAuditDetail.ItemAdded(item).Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void ItemChangedWritesOldAndNewOnTheChangedPairsThenTheChangedTextFieldNames()
    {
        var order = NewOrder("ORD-2026-0001");
        var item = order.Items[0];
        var oldType = item.ProductTypeId;
        var newType = Guid.Parse("01a17fce-7801-7e45-b875-357767854eda");
        var changes = order.UpdateItem(item.Id, new NewOrderItem(newType, "Private words", null, 20, 700.00m), Now.AddDays(1)).Value;

        var detail = OrderAuditDetail.ItemChanged(item, changes);

        detail.ShouldBe($"item={item.Id:D};productType={oldType:D}>{newType:D};quantity=15>20;unitPrice=650.00>700.00;fields=description,sizeVariant");
        detail.ShouldNotContain("Private", Case.Insensitive);
        detail.Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void ItemChangedWithOnlyATextChangeKeepsTheCurrentPairsAndNamesTheField()
    {
        var order = NewOrder("ORD-2026-0001");
        var item = order.Items[0];
        var changes = order.UpdateItem(item.Id, new NewOrderItem(item.ProductTypeId, "Different words", "S-XL", 15, 650.00m), Now.AddDays(1)).Value;

        OrderAuditDetail.ItemChanged(item, changes).ShouldBe($"item={item.Id:D};productType={item.ProductTypeId:D};quantity=15;unitPrice=650.00;fields=description");
    }

    [Fact]
    public void NullItemsAndChangesAreAProgrammingError()
    {
        var order = NewOrder("ORD-2026-0001");
        var changes = order.UpdateItem(order.Items[0].Id, new NewOrderItem(order.Items[0].ProductTypeId, "Jersey top", "S-XL", 16, 650.00m), Now.AddDays(1)).Value;

        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.ItemAdded(null!));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.ItemRemoved(null!));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.ItemChanged(null!, changes));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.ItemChanged(order.Items[0], null!));
    }

    [Fact]
    public void DiscountAddedAndRemovedHoldTheDiscountIdKindAndValueOnly()
    {
        var order = NewOrder("ORD-2026-0001");
        var discount = order.AddDiscount(new NewOrderDiscount(DiscountKind.Percentage, 5m, "Private reason"), Now.AddDays(1)).Value;
        var expected = $"discount={discount.Id:D};kind=percentage;value=5.00";

        OrderAuditDetail.DiscountAdded(discount).ShouldBe(expected);
        OrderAuditDetail.DiscountRemoved(discount).ShouldBe(expected);
        OrderAuditDetail.DiscountAdded(discount).ShouldNotContain("Private", Case.Insensitive);
        OrderAuditDetail.DiscountAdded(discount).Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void DiscountChangedWritesOldAndNewOnTheChangedPairsThenTheReasonFieldName()
    {
        var order = NewOrder("ORD-2026-0001");
        var discount = order.AddDiscount(new NewOrderDiscount(DiscountKind.Percentage, 5m, "League"), Now).Value;
        var changes = order.UpdateDiscount(discount.Id, new NewOrderDiscount(DiscountKind.Fixed, 500m, "Private words"), Now.AddDays(1)).Value;

        var detail = OrderAuditDetail.DiscountChanged(discount, changes);

        detail.ShouldBe($"discount={discount.Id:D};kind=percentage>fixed;value=5.00>500.00;fields=reason");
        detail.ShouldNotContain("Private", Case.Insensitive);
        detail.Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void DiscountChangedWithOnlyAReasonChangeKeepsTheCurrentPairsAndNamesTheField()
    {
        var order = NewOrder("ORD-2026-0001");
        var discount = order.AddDiscount(new NewOrderDiscount(DiscountKind.Percentage, 5m, "League"), Now).Value;
        var changes = order.UpdateDiscount(discount.Id, new NewOrderDiscount(DiscountKind.Percentage, 5m, "Club"), Now.AddDays(1)).Value;

        OrderAuditDetail.DiscountChanged(discount, changes).ShouldBe($"discount={discount.Id:D};kind=percentage;value=5.00;fields=reason");
    }

    [Fact]
    public void DiscountChangedWithOnlyAValueChangeHasNoFieldsPair()
    {
        var order = NewOrder("ORD-2026-0001");
        var discount = order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 100m, "League"), Now).Value;
        var changes = order.UpdateDiscount(discount.Id, new NewOrderDiscount(DiscountKind.Fixed, 150m, "League"), Now.AddDays(1)).Value;

        OrderAuditDetail.DiscountChanged(discount, changes).ShouldBe($"discount={discount.Id:D};kind=fixed;value=100.00>150.00");
    }

    [Fact]
    public void NullDiscountsAndChangesAreAProgrammingError()
    {
        var order = NewOrder("ORD-2026-0001");
        var discount = order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 100m, "League"), Now).Value;
        var changes = order.UpdateDiscount(discount.Id, new NewOrderDiscount(DiscountKind.Fixed, 150m, "League"), Now.AddDays(1)).Value;

        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.DiscountAdded(null!));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.DiscountRemoved(null!));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.DiscountChanged(null!, changes));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.DiscountChanged(discount, null!));
    }

    [Fact]
    public void PaymentAddedAndRemovedHoldTheIdDateAmountMethodAndReceiverOnly()
    {
        var order = NewOrder("ORD-2026-0001");
        var payment = order.AddPayment(new NewOrderPayment(new DateOnly(2026, 10, 25), 5000m, Method, "Private ref", "Private notes", Receiver), new DateOnly(2026, 10, 28), Now).Value;
        var expected = $"payment={payment.Id:D};date=2026-10-25;amount=5000.00;method={Method:D};receiver={Receiver:D}";

        OrderAuditDetail.PaymentAdded(payment).ShouldBe(expected);
        OrderAuditDetail.PaymentRemoved(payment).ShouldBe(expected);
        OrderAuditDetail.PaymentAdded(payment).ShouldNotContain("Private", Case.Insensitive);
        OrderAuditDetail.PaymentAdded(payment).Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void PaymentChangedWritesOldAndNewOnTheChangedPairsThenTheFieldNamesAndTheCurrentReceiver()
    {
        var order = NewOrder("ORD-2026-0001");
        var payment = order.AddPayment(new NewOrderPayment(new DateOnly(2026, 10, 25), 5000m, Method, "ref", "note", Receiver), new DateOnly(2026, 10, 28), Now).Value;
        var changes = order.UpdatePayment(
            payment.Id,
            new NewOrderPayment(new DateOnly(2026, 10, 26), 4000m, OtherMethod, "Private ref", "Private notes", OtherReceiver),
            new DateOnly(2026, 10, 28),
            Now.AddDays(1)).Value;

        var detail = OrderAuditDetail.PaymentChanged(payment, changes);

        detail.ShouldBe($"payment={payment.Id:D};date=2026-10-25>2026-10-26;amount=5000.00>4000.00;method={Method:D}>{OtherMethod:D};receiver={OtherReceiver:D};fields=reference,notes");
        detail.ShouldNotContain("Private", Case.Insensitive);
        detail.Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void PaymentChangedWithOnlyAnAmountChangeKeepsTheCurrentPairsAndHasNoFieldsPair()
    {
        var order = NewOrder("ORD-2026-0001");
        var payment = order.AddPayment(new NewOrderPayment(new DateOnly(2026, 10, 25), 5000m, Method, null, null, Receiver), new DateOnly(2026, 10, 28), Now).Value;
        var changes = order.UpdatePayment(payment.Id, new NewOrderPayment(new DateOnly(2026, 10, 25), 4000m, Method, null, null, Receiver), new DateOnly(2026, 10, 28), Now.AddDays(1)).Value;

        OrderAuditDetail.PaymentChanged(payment, changes).ShouldBe($"payment={payment.Id:D};date=2026-10-25;amount=5000.00>4000.00;method={Method:D};receiver={Receiver:D}");
    }

    [Fact]
    public void PaymentReceiverChangedHoldsTheIdAndTheOldAndNewReceiver()
    {
        var order = NewOrder("ORD-2026-0001");
        var payment = order.AddPayment(new NewOrderPayment(new DateOnly(2026, 10, 25), 5000m, Method, null, null, Receiver), new DateOnly(2026, 10, 28), Now).Value;
        var changes = order.UpdatePayment(payment.Id, new NewOrderPayment(new DateOnly(2026, 10, 25), 5000m, Method, null, null, OtherReceiver), new DateOnly(2026, 10, 28), Now.AddDays(1)).Value;

        var detail = OrderAuditDetail.PaymentReceiverChanged(payment, changes.Receiver.ShouldNotBeNull());

        detail.ShouldBe($"payment={payment.Id:D};receiver={Receiver:D}>{OtherReceiver:D}");
    }

    [Fact]
    public void NullPaymentsAndChangesAreAProgrammingError()
    {
        var order = NewOrder("ORD-2026-0001");
        var payment = order.AddPayment(new NewOrderPayment(new DateOnly(2026, 10, 25), 5000m, Method, null, null, Receiver), new DateOnly(2026, 10, 28), Now).Value;
        var changes = order.UpdatePayment(payment.Id, new NewOrderPayment(new DateOnly(2026, 10, 25), 4000m, Method, null, null, OtherReceiver), new DateOnly(2026, 10, 28), Now.AddDays(1)).Value;

        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.PaymentAdded(null!));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.PaymentRemoved(null!));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.PaymentChanged(null!, changes));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.PaymentChanged(payment, null!));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.PaymentReceiverChanged(null!, changes.Receiver.ShouldNotBeNull()));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.PaymentReceiverChanged(payment, null!));
    }

    [Fact]
    public void ExpenseAddedAndRemovedHoldTheIdDateAmountCategoryAndPayerOnly()
    {
        var order = NewOrder("ORD-2026-0001");
        var expense = order.AddExpense(new NewOrderExpense(new DateOnly(2026, 10, 23), 3825m, Category, "Private words", Receiver), new DateOnly(2026, 10, 28), Now).Value;
        var expected = $"expense={expense.Id:D};date=2026-10-23;amount=3825.00;category={Category:D};payer={Receiver:D}";

        OrderAuditDetail.ExpenseAdded(expense).ShouldBe(expected);
        OrderAuditDetail.ExpenseRemoved(expense).ShouldBe(expected);
        OrderAuditDetail.ExpenseAdded(expense).ShouldNotContain("Private", Case.Insensitive);
        OrderAuditDetail.ExpenseAdded(expense).Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void ExpenseChangedWritesOldAndNewOnTheChangedPairsThenTheFieldNameAndTheCurrentPayer()
    {
        var order = NewOrder("ORD-2026-0001");
        var expense = order.AddExpense(new NewOrderExpense(new DateOnly(2026, 10, 23), 3825m, Category, "Mesh", Receiver), new DateOnly(2026, 10, 28), Now).Value;
        var changes = order.UpdateExpense(
            expense.Id,
            new NewOrderExpense(new DateOnly(2026, 10, 24), 3000m, OtherCategory, "Private words", OtherReceiver),
            new DateOnly(2026, 10, 28),
            Now.AddDays(1)).Value;

        var detail = OrderAuditDetail.ExpenseChanged(expense, changes);

        detail.ShouldBe($"expense={expense.Id:D};date=2026-10-23>2026-10-24;amount=3825.00>3000.00;category={Category:D}>{OtherCategory:D};payer={OtherReceiver:D};fields=description");
        detail.ShouldNotContain("Private", Case.Insensitive);
        detail.Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void ExpenseChangedWithOnlyAnAmountChangeKeepsTheCurrentPairsAndHasNoFieldsPair()
    {
        var order = NewOrder("ORD-2026-0001");
        var expense = order.AddExpense(new NewOrderExpense(new DateOnly(2026, 10, 23), 3825m, Category, null, Receiver), new DateOnly(2026, 10, 28), Now).Value;
        var changes = order.UpdateExpense(expense.Id, new NewOrderExpense(new DateOnly(2026, 10, 23), 3000m, Category, null, Receiver), new DateOnly(2026, 10, 28), Now.AddDays(1)).Value;

        OrderAuditDetail.ExpenseChanged(expense, changes).ShouldBe($"expense={expense.Id:D};date=2026-10-23;amount=3825.00>3000.00;category={Category:D};payer={Receiver:D}");
    }

    [Fact]
    public void ExpensePayerChangedHoldsTheIdAndTheOldAndNewPayer()
    {
        var order = NewOrder("ORD-2026-0001");
        var expense = order.AddExpense(new NewOrderExpense(new DateOnly(2026, 10, 23), 3825m, Category, null, Receiver), new DateOnly(2026, 10, 28), Now).Value;
        var changes = order.UpdateExpense(expense.Id, new NewOrderExpense(new DateOnly(2026, 10, 23), 3825m, Category, null, OtherReceiver), new DateOnly(2026, 10, 28), Now.AddDays(1)).Value;

        var detail = OrderAuditDetail.ExpensePayerChanged(expense, changes.Payer.ShouldNotBeNull());

        detail.ShouldBe($"expense={expense.Id:D};payer={Receiver:D}>{OtherReceiver:D}");
    }

    [Fact]
    public void NullExpensesAndChangesAreAProgrammingError()
    {
        var order = NewOrder("ORD-2026-0001");
        var expense = order.AddExpense(new NewOrderExpense(new DateOnly(2026, 10, 23), 3825m, Category, null, Receiver), new DateOnly(2026, 10, 28), Now).Value;
        var changes = order.UpdateExpense(expense.Id, new NewOrderExpense(new DateOnly(2026, 10, 23), 3000m, Category, null, OtherReceiver), new DateOnly(2026, 10, 28), Now.AddDays(1)).Value;

        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.ExpenseAdded(null!));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.ExpenseRemoved(null!));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.ExpenseChanged(null!, changes));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.ExpenseChanged(expense, null!));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.ExpensePayerChanged(null!, changes.Payer.ShouldNotBeNull()));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.ExpensePayerChanged(expense, null!));
    }

    [Fact]
    public void CreatedShowsTheTotalAfterTheDiscountsInTheBody()
    {
        var items = new[] { new NewOrderItem(Guid.NewGuid(), "Jersey top", "S-XL", 15, 650.00m) };
        var order = Order.Create(new NewOrder(Details(), OrderStatus.Pending, items) { Discounts = [new NewOrderDiscount(DiscountKind.Percentage, 10m, "Private reason")] }, Guid.NewGuid(), Now).Value;
        order.AssignNumber("ORD-2026-0001");

        var detail = OrderAuditDetail.Created(order);

        detail.ShouldBe("number=ORD-2026-0001;status=pending;orderDate=2026-10-28;dueDate=2026-11-11;items=1;total=8775.00");
        detail.ShouldNotContain("Private", Case.Insensitive);
    }

    [Theory]
    [InlineData(OrderStatus.Pending, OrderStatus.Mockup, "status=pending>mockup")]
    [InlineData(OrderStatus.Mockup, OrderStatus.InProduction, "status=mockup>production")]
    [InlineData(OrderStatus.Delivered, OrderStatus.Cancelled, "status=delivered>cancelled")]
    [InlineData(OrderStatus.Completed, OrderStatus.Ready, "status=completed>ready")]
    [InlineData(OrderStatus.Cancelled, OrderStatus.Pending, "status=cancelled>pending")]
    public void StatusChangedShowsTheOldAndNewStatusByWireKey(OrderStatus from, OrderStatus to, string expected)
    {
        var detail = OrderAuditDetail.StatusChanged(from, to);

        detail.ShouldBe(expected);
        detail.Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void StatusChangedWithAnUnknownStatusIsAProgrammingError()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => OrderAuditDetail.StatusChanged((OrderStatus)99, OrderStatus.Pending));
        Should.Throw<ArgumentOutOfRangeException>(() => OrderAuditDetail.StatusChanged(OrderStatus.Pending, (OrderStatus)99));
    }

    [Fact]
    public void RefundAddedAndRemovedHoldTheIdDateAmountAndRefunderOnly()
    {
        var order = CancelledPaidOrder();
        var refund = order.AddRefund(new NewOrderRefund(new DateOnly(2026, 10, 28), 9750m, "Private words", Receiver), new DateOnly(2026, 10, 28), Now).Value;
        var expected = $"refund={refund.Id:D};date=2026-10-28;amount=9750.00;refunder={Receiver:D}";

        OrderAuditDetail.RefundAdded(refund).ShouldBe(expected);
        OrderAuditDetail.RefundRemoved(refund).ShouldBe(expected);
        OrderAuditDetail.RefundAdded(refund).ShouldNotContain("Private", Case.Insensitive);
        OrderAuditDetail.RefundAdded(refund).Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void RefundChangedWritesOldAndNewOnTheChangedPairsThenTheCurrentRefunderAndTheReasonFieldName()
    {
        var order = CancelledPaidOrder();
        var refund = order.AddRefund(new NewOrderRefund(new DateOnly(2026, 10, 27), 9750m, "Cancelled", Receiver), new DateOnly(2026, 10, 28), Now).Value;
        var changes = order.UpdateRefund(
            refund.Id,
            new NewOrderRefund(new DateOnly(2026, 10, 28), 5000m, "Private words", OtherReceiver),
            new DateOnly(2026, 10, 28),
            Now.AddDays(1)).Value;

        var detail = OrderAuditDetail.RefundChanged(refund, changes);

        detail.ShouldBe($"refund={refund.Id:D};date=2026-10-27>2026-10-28;amount=9750.00>5000.00;refunder={OtherReceiver:D};fields=reason");
        detail.ShouldNotContain("Private", Case.Insensitive);
        detail.Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void RefundChangedWithOnlyAnAmountChangeKeepsTheCurrentPairsAndHasNoFieldsPair()
    {
        var order = CancelledPaidOrder();
        var refund = order.AddRefund(new NewOrderRefund(new DateOnly(2026, 10, 27), 9750m, "Cancelled", Receiver), new DateOnly(2026, 10, 28), Now).Value;
        var changes = order.UpdateRefund(refund.Id, new NewOrderRefund(new DateOnly(2026, 10, 27), 5000m, "Cancelled", Receiver), new DateOnly(2026, 10, 28), Now.AddDays(1)).Value;

        OrderAuditDetail.RefundChanged(refund, changes).ShouldBe($"refund={refund.Id:D};date=2026-10-27;amount=9750.00>5000.00;refunder={Receiver:D}");
    }

    [Fact]
    public void RefundRefunderChangedHoldsTheIdAndTheOldAndNewRefunder()
    {
        var order = CancelledPaidOrder();
        var refund = order.AddRefund(new NewOrderRefund(new DateOnly(2026, 10, 27), 9750m, "Cancelled", Receiver), new DateOnly(2026, 10, 28), Now).Value;
        var changes = order.UpdateRefund(refund.Id, new NewOrderRefund(new DateOnly(2026, 10, 27), 9750m, "Cancelled", OtherReceiver), new DateOnly(2026, 10, 28), Now.AddDays(1)).Value;

        var detail = OrderAuditDetail.RefundRefunderChanged(refund, changes.Refunder.ShouldNotBeNull());

        detail.ShouldBe($"refund={refund.Id:D};refunder={Receiver:D}>{OtherReceiver:D}");
    }

    [Fact]
    public void NullRefundsAndChangesAreAProgrammingError()
    {
        var order = CancelledPaidOrder();
        var refund = order.AddRefund(new NewOrderRefund(new DateOnly(2026, 10, 27), 9750m, "Cancelled", Receiver), new DateOnly(2026, 10, 28), Now).Value;
        var changes = order.UpdateRefund(refund.Id, new NewOrderRefund(new DateOnly(2026, 10, 27), 5000m, "Cancelled", OtherReceiver), new DateOnly(2026, 10, 28), Now.AddDays(1)).Value;

        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.RefundAdded(null!));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.RefundRemoved(null!));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.RefundChanged(null!, changes));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.RefundChanged(refund, null!));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.RefundRefunderChanged(null!, changes.Refunder.ShouldNotBeNull()));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.RefundRefunderChanged(refund, null!));
    }

    [Fact]
    public void PermanentlyDeletedHoldsTheDocumentedKeysInOrderForTheFullOrder()
    {
        var order = FullOrder();

        var detail = OrderAuditDetail.PermanentlyDeleted(order);

        detail.ShouldBe(
            "number=ORD-2026-0148;status=pending;subtotal=22450.00;discount=1122.50;total=21327.50;paid=12000.00;refunded=0.00;balance=9327.50;expenses=6065.00"
            + $";receivers={Receiver:D},{OtherReceiver:D};payers={OtherReceiver:D},{Receiver:D};refunders=");
        detail.Length.ShouldBeLessThanOrEqualTo(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void PermanentlyDeletedHoldsNoCustomerTeamContactEmailAddressNotesOrChildText()
    {
        var detail = OrderAuditDetail.PermanentlyDeleted(FullOrder());

        foreach (var secret in new[] { "Juan", "Dela Cruz", "Ballers", "0917", "juan.dc", "Brgy.", "rush", "Jersey top", "Barangay league", "Dri-fit", "9012" })
        {
            detail.ShouldNotContain(secret, Case.Insensitive);
        }
    }

    [Fact]
    public void PermanentlyDeletedNamesEachPersonOnceInTheOrderTheyFirstAppearAndTheRefundersAndRefundedTotal()
    {
        var order = FullOrder();
        order.ChangeStatus(OrderStatus.Cancelled, Receiver, Now).IsSuccess.ShouldBeTrue();
        order.AddRefund(new NewOrderRefund(new DateOnly(2026, 10, 27), 2000m, "Cancelled", OtherReceiver), new DateOnly(2026, 10, 28), Now).IsSuccess.ShouldBeTrue();
        order.AddRefund(new NewOrderRefund(new DateOnly(2026, 10, 27), 1000m, "Cancelled", Receiver), new DateOnly(2026, 10, 28), Now).IsSuccess.ShouldBeTrue();
        order.AddRefund(new NewOrderRefund(new DateOnly(2026, 10, 27), 500m, "Cancelled", OtherReceiver), new DateOnly(2026, 10, 28), Now).IsSuccess.ShouldBeTrue();

        var detail = OrderAuditDetail.PermanentlyDeleted(order);

        var parts = AuditDetailFormat.Parse(detail).ToDictionary(part => part.Key, part => part.To, StringComparer.Ordinal);
        parts["status"].ShouldBe("cancelled");
        parts["refunded"].ShouldBe("3500.00");
        parts["receivers"].ShouldBe($"{Receiver:D},{OtherReceiver:D}");
        parts["refunders"].ShouldBe($"{OtherReceiver:D},{Receiver:D}");
    }

    [Fact]
    public void PermanentlyDeletedStaysUnderTheAuditLimitWithManyPeopleAndSaysHowManyWereLeftOut()
    {
        var people = Enumerable.Range(1, 8).Select(static index => Guid.Parse($"a{index}1d7c92-0b58-4e3f-96d1-8c2e5f7a3b04")).ToArray();
        var today = new DateOnly(2026, 10, 28);
        var items = new[] { new NewOrderItem(Guid.NewGuid(), "Jersey top", "S-XL", 15, 650.00m) };
        var payments = people.Select(person => new NewOrderPayment(today, 100m, Method, null, null, person)).ToArray();
        var expenses = people.Select(person => new NewOrderExpense(today, 10m, Category, null, person)).ToArray();
        var order = Order.Create(new NewOrder(Details(), OrderStatus.Pending, items) { Payments = payments, Expenses = expenses }, Guid.NewGuid(), Now, today).Value;
        order.AssignNumber("ORD-2026-0148");
        order.ChangeStatus(OrderStatus.Cancelled, Receiver, Now).IsSuccess.ShouldBeTrue();
        foreach (var person in people)
        {
            order.AddRefund(new NewOrderRefund(today, 10m, "Cancelled", person), today, Now).IsSuccess.ShouldBeTrue();
        }

        var detail = OrderAuditDetail.PermanentlyDeleted(order);

        detail.Length.ShouldBeLessThanOrEqualTo(AuditEntry.DetailMaxLength);
        var parts = AuditDetailFormat.Parse(detail).ToDictionary(part => part.Key, part => part.To, StringComparer.Ordinal);
        parts.Keys.ShouldBe(
            ["number", "status", "subtotal", "discount", "total", "paid", "refunded", "balance", "expenses", "receivers", "payers", "refunders"]);
        var kept = 0;
        var left = 0;
        foreach (var key in new[] { "receivers", "payers", "refunders" })
        {
            var entries = parts[key].Split(',', StringSplitOptions.RemoveEmptyEntries);
            kept += entries.Count(static entry => !entry.StartsWith('+'));
            entries.Where(static entry => entry.StartsWith('+')).ToArray().Length.ShouldBeLessThanOrEqualTo(1);
            entries.Where(static entry => !entry.StartsWith('+')).ShouldAllBe(entry => people.Any(person => person.ToString("D") == entry));
            left += entries.Where(static entry => entry.StartsWith('+')).Sum(static entry => int.Parse(entry[1..], System.Globalization.CultureInfo.InvariantCulture));
        }

        kept.ShouldBeGreaterThan(0);
        left.ShouldBeGreaterThan(0);
        (kept + left).ShouldBe(24);
    }

    [Fact]
    public void DeletedAndRestoredHoldTheNumberStatusTotalPaidAndBalanceAndNoText()
    {
        var order = FullOrder();

        var deleted = OrderAuditDetail.Deleted(order);
        var restored = OrderAuditDetail.Restored(order);

        deleted.ShouldBe("number=ORD-2026-0148;status=pending;total=21327.50;paid=12000.00;balance=9327.50");
        restored.ShouldBe(deleted);
        foreach (var secret in new[] { "Juan", "Ballers", "0917", "juan.dc", "Brgy.", "rush" })
        {
            deleted.ShouldNotContain(secret, Case.Insensitive);
        }
    }

    [Fact]
    public void NullOrdersAreAProgrammingErrorForTheDeleteDetails()
    {
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.Deleted(null!));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.Restored(null!));
        Should.Throw<ArgumentNullException>(() => OrderAuditDetail.PermanentlyDeleted(null!));
    }

    // ORD-2026-0148: five lines (22,450.00), a 5% discount, payments of 10,000.00 (Receiver) and 2,000.00 (OtherReceiver), and
    // expenses of 3,825.00 (OtherReceiver), 1,640.00 and 600.00 (Receiver).
    private static Order FullOrder()
    {
        var today = new DateOnly(2026, 10, 28);
        var items = new[]
        {
            new NewOrderItem(Guid.NewGuid(), "Jersey top", "S-XL", 15, 650.00m),
            new NewOrderItem(Guid.NewGuid(), "Jersey shorts", "S-XL", 15, 300.00m),
            new NewOrderItem(Guid.NewGuid(), "Coach polo", "L", 2, 550.00m),
            new NewOrderItem(Guid.NewGuid(), "Warm-up long sleeves", "M-XL", 15, 420.00m),
            new NewOrderItem(Guid.NewGuid(), "Team banner", null, 1, 800.00m),
        };
        var payments = new[]
        {
            new NewOrderPayment(today, 10000.00m, Method, "9012 345 678901", "50% downpayment", Receiver),
            new NewOrderPayment(today, 2000.00m, OtherMethod, null, null, OtherReceiver),
        };
        var expenses = new[]
        {
            new NewOrderExpense(today, 3825.00m, Category, "Dri-fit mesh, 45 yds", OtherReceiver),
            new NewOrderExpense(today, 1640.00m, OtherCategory, "Sublimation ink", Receiver),
            new NewOrderExpense(today, 600.00m, OtherCategory, "Embroidery", Receiver),
        };
        var discounts = new[] { new NewOrderDiscount(DiscountKind.Percentage, 5m, "Barangay league discount") };
        var order = Order.Create(
            new NewOrder(Details(), OrderStatus.Pending, items) { Discounts = discounts, Payments = payments, Expenses = expenses },
            Guid.NewGuid(),
            Now,
            today).Value;
        order.AssignNumber("ORD-2026-0148");
        return order;
    }

    // One item of 9,750.00, paid in full, then cancelled, so a refund up to 9,750.00 is allowed.
    private static Order CancelledPaidOrder()
    {
        var today = new DateOnly(2026, 10, 28);
        var items = new[] { new NewOrderItem(Guid.NewGuid(), "Jersey top", "S-XL", 15, 650.00m) };
        var payments = new[] { new NewOrderPayment(today, 9750.00m, Method, null, null, Receiver) };
        var order = Order.Create(new NewOrder(Details(), OrderStatus.Pending, items) { Payments = payments }, Guid.NewGuid(), Now, today).Value;
        order.AssignNumber("ORD-2026-0001");
        order.ChangeStatus(OrderStatus.Cancelled, Receiver, Now).IsSuccess.ShouldBeTrue();
        return order;
    }

    private static Order NewOrder(string number)
    {
        var items = new[] { new NewOrderItem(Guid.NewGuid(), "Jersey top", "S-XL", 15, 650.00m) };
        var order = Order.Create(new NewOrder(Details(), OrderStatus.Pending, items), Guid.NewGuid(), Now).Value;
        order.AssignNumber(number);
        return order;
    }

    private static OrderDetails Details() => new(
        "Juan Dela Cruz",
        "Brgy. San Roque Ballers",
        "0917 123 4567",
        "juan.dc@example.com",
        "Brgy. San Roque",
        new DateOnly(2026, 10, 28),
        new DateOnly(2026, 11, 11),
        "rush job");
}
