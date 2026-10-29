using Csps.Domain.Common;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>
/// D-49b: an edit re-checks only the fields it changes, so a legacy value that the import accepted stays editable around. The
/// D-05 lock and the caps that depend on the totals are unchanged.
/// </summary>
public sealed class OrderLegacyEditTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = new(2026, 10, 29, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 28);
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid Cash = Guid.Parse("01a17fce-7806-77e1-91b7-d3b852f2fd1d");
    private static readonly Guid Fabric = Guid.Parse("01a17fce-780b-75d1-89e0-5b3b9b185a2c");
    private static readonly Guid Admin = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");

    [Fact]
    public void ALegacyItemWithQuantityZeroKeepsItAndTakesATextEditAndAPriceEdit()
    {
        var order = Legacy(items: [Item(quantity: 0, unitPrice: 650.00m), Item(quantity: 1, unitPrice: 100.00m)]);
        var itemId = order.Items[0].Id;

        var text = order.UpdateItem(itemId, Item(quantity: 0, unitPrice: 650.00m) with { Description = "Jersey top, long" }, Later);
        var price = order.UpdateItem(itemId, Item(quantity: 0, unitPrice: 700.00m), Later);

        text.IsSuccess.ShouldBeTrue();
        text.Value.ChangedFields.ShouldBe(["description"]);
        price.IsSuccess.ShouldBeTrue();
        order.Items[0].Quantity.ShouldBe(0);
        order.Items[0].UnitPrice.ShouldBe(700.00m);
    }

    [Fact]
    public void ALegacyItemAboveTheCapsKeepsItsQuantityAndPriceButAChangedOneIsStillChecked()
    {
        var order = Legacy(items: [Item(quantity: 20_000, unitPrice: 2_000_000.00m)]);
        var itemId = order.Items[0].Id;

        var text = order.UpdateItem(itemId, Item(quantity: 20_000, unitPrice: 2_000_000.00m) with { SizeVariant = "XL" }, Later);
        var quantity = order.UpdateItem(itemId, Item(quantity: 30_000, unitPrice: 2_000_000.00m), Later);
        var price = order.UpdateItem(itemId, Item(quantity: 20_000, unitPrice: 3_000_000.00m), Later);
        var fixedQuantity = order.UpdateItem(itemId, Item(quantity: 10, unitPrice: 2_000_000.00m), Later);

        text.IsSuccess.ShouldBeTrue();
        quantity.Error.FieldErrors.ShouldNotBeNull()["quantity"].ShouldBe([OrderRules.QuantityOutOfRange]);
        price.Error.FieldErrors.ShouldNotBeNull()["unitPrice"].ShouldBe([OrderRules.UnitPriceOutOfRange]);
        fixedQuantity.IsSuccess.ShouldBeTrue();
        order.Items[0].Quantity.ShouldBe(10);
    }

    [Fact]
    public void ALegacyPaymentAboveTheCapAndDatedInTheFutureTakesANotesEditButNotANewAmountOrDateAboveTheRules()
    {
        var order = Legacy(payments: [Payment(2_000_000.00m) with { PaymentDate = Today.AddDays(5) }]);
        var paymentId = order.Payments[0].Id;
        var stored = Payment(2_000_000.00m) with { PaymentDate = Today.AddDays(5) };

        var notes = order.UpdatePayment(paymentId, stored with { Notes = "Receipt found" }, Today, Later);
        var amount = order.UpdatePayment(paymentId, stored with { Amount = 1_500_000.00m }, Today, Later);
        var date = order.UpdatePayment(paymentId, stored with { PaymentDate = Today.AddDays(6) }, Today, Later);

        notes.IsSuccess.ShouldBeTrue();
        order.Payments[0].Notes.ShouldBe("Receipt found");
        order.Payments[0].Amount.ShouldBe(2_000_000.00m);
        amount.Error.FieldErrors.ShouldNotBeNull()["amount"].ShouldBe([OrderRules.PaymentAmountOutOfRange]);
        date.Error.FieldErrors.ShouldNotBeNull()["paymentDate"].ShouldBe([OrderRules.PaymentDateInFuture]);
    }

    [Fact]
    public void ALegacyExpenseAboveTheCapAndDatedFarAheadTakesADescriptionEdit()
    {
        var legacy = Expense(2_000_000.00m) with { ExpenseDate = Today.AddDays(60) };
        var order = Legacy(expenses: [legacy]);
        var expenseId = order.Expenses[0].Id;

        var description = order.UpdateExpense(expenseId, legacy with { Description = "Mesh, corrected" }, Today, Later);
        var amount = order.UpdateExpense(expenseId, legacy with { Amount = 1_500_000.00m }, Today, Later);
        var date = order.UpdateExpense(expenseId, legacy with { ExpenseDate = Today.AddDays(61) }, Today, Later);

        description.IsSuccess.ShouldBeTrue();
        order.Expenses[0].Description.ShouldBe("Mesh, corrected");
        amount.Error.FieldErrors.ShouldNotBeNull()["amount"].ShouldBe([ExpenseTooLarge]);
        date.IsFailure.ShouldBeTrue();
        date.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["expenseDate"]);
    }

    [Fact]
    public void ALegacyRefundAboveTheCapAndDatedInTheFutureTakesAReasonEditButNotAChangedAmount()
    {
        var legacy = Refund(2_000_000.00m) with { RefundDate = Today.AddDays(3) };
        var order = Legacy(refunds: [legacy], status: OrderStatus.Cancelled);
        var refundId = order.Refunds[0].Id;

        var reason = order.UpdateRefund(refundId, legacy with { Reason = "Customer asked" }, Today, Later);
        var amount = order.UpdateRefund(refundId, legacy with { Amount = 1_500_000.00m }, Today, Later);
        var date = order.UpdateRefund(refundId, legacy with { RefundDate = Today.AddDays(4) }, Today, Later);

        reason.IsSuccess.ShouldBeTrue();
        order.Refunds[0].Reason.ShouldBe("Customer asked");
        amount.Error.FieldErrors.ShouldNotBeNull()["amount"].ShouldBe([OrderRules.PaymentAmountOutOfRange]);
        date.Error.FieldErrors.ShouldNotBeNull()["refundDate"].ShouldBe([OrderRules.RefundDateInFuture]);
    }

    [Fact]
    public void ALegacyDiscountAboveTheCapTakesAReasonEditWhileTheItemsStillCoverItAndAChangedValueIsChecked()
    {
        var order = Legacy(
            items: [Item(quantity: 1, unitPrice: 5_000_000.00m)],
            discounts: [new NewOrderDiscount(DiscountKind.Fixed, 2_000_000.00m, "Team deal")]);
        var discountId = order.Discounts[0].Id;

        var reason = order.UpdateDiscount(discountId, new NewOrderDiscount(DiscountKind.Fixed, 2_000_000.00m, "Team deal, corrected"), Later);
        var value = order.UpdateDiscount(discountId, new NewOrderDiscount(DiscountKind.Fixed, 2_500_000.00m, "Team deal, corrected"), Later);
        var kind = order.UpdateDiscount(discountId, new NewOrderDiscount(DiscountKind.Percentage, 2_000_000.00m, "Team deal, corrected"), Later);

        reason.IsSuccess.ShouldBeTrue();
        order.Discounts[0].Reason.ShouldBe("Team deal, corrected");
        value.Error.FieldErrors.ShouldNotBeNull()["value"].ShouldBe([OrderRules.FixedDiscountOutOfRange]);
        kind.Error.FieldErrors.ShouldNotBeNull()["value"].ShouldBe([OrderRules.PercentDiscountOutOfRange]);
    }

    [Fact]
    public void ALegacyDiscountAboveTheItemsTotalStillRefusesAnEditBecauseTheTotalsCapIsUnchanged()
    {
        var order = Legacy(discounts: [new NewOrderDiscount(DiscountKind.Fixed, 20_000.00m, "Team deal")]);

        var result = order.UpdateDiscount(order.Discounts[0].Id, new NewOrderDiscount(DiscountKind.Fixed, 20_000.00m, "Corrected"), Later);

        result.Error.FieldErrors.ShouldNotBeNull()["value"].ShouldBe([OrderRules.DiscountAboveSubtotalMessage]);
    }

    [Fact]
    public void ALegacyPaymentOverTheTotalStillCannotBeRaisedBecauseTheBalanceCapIsUnchanged()
    {
        var order = Legacy(payments: [Payment(10_000.00m)]);

        var result = order.UpdatePayment(order.Payments[0].Id, Payment(10_000.01m), Today, Later);

        result.Error.FieldErrors.ShouldNotBeNull()["amount"].ShouldBe([OrderRules.PaymentAboveBalance(9750.00m)]);
    }

    [Fact]
    public void AnOrderWithoutAContactNumberTakesAnEditOfOtherDetailsButAChangedNumberIsStillChecked()
    {
        var order = Legacy();
        var details = Details() with { ContactNumber = null };

        var notes = order.UpdateDetails(details with { Notes = "Pick up at the shop" }, Later);
        var bad = order.UpdateDetails(details with { ContactNumber = "call me" }, Later);
        var blankAgain = order.UpdateDetails(details with { ContactNumber = "   ", Notes = "Pick up at the shop" }, Later);

        notes.IsSuccess.ShouldBeTrue();
        order.ContactNumber.ShouldBeNull();
        order.Notes.ShouldBe("Pick up at the shop");
        bad.Error.FieldErrors.ShouldNotBeNull()["contactNumber"].ShouldBe([OrderRules.ContactNumberInvalid]);
        blankAgain.IsSuccess.ShouldBeTrue();
        blankAgain.Value.HasAny.ShouldBeFalse();
    }

    [Fact]
    public void ANewOrderStillNeedsAContactNumberAndALegacyOrderWithoutADueDateStillNeedsOneOnEdit()
    {
        var order = Legacy();
        var kept = Legacy(details: Details() with { DueDate = null });

        var cleared = order.UpdateDetails(Details() with { ContactNumber = null }, Later);
        var noDue = kept.UpdateDetails(Details() with { DueDate = null, Notes = "x" }, Later);

        cleared.IsSuccess.ShouldBeFalse("a stored number may not be cleared");
        cleared.Error.FieldErrors.ShouldNotBeNull()["contactNumber"].ShouldBe([OrderRules.ContactNumberRequired]);
        noDue.Error.FieldErrors.ShouldNotBeNull()["dueDate"].ShouldBe([OrderRules.DueDateRequired]);
    }

    [Fact]
    public void ALockedLegacyOrderStillRefusesEveryEdit()
    {
        var order = Legacy(items: [Item(quantity: 0, unitPrice: 650.00m)], status: OrderStatus.Cancelled);

        var result = order.UpdateItem(order.Items[0].Id, Item(quantity: 0, unitPrice: 650.00m) with { SizeVariant = "XL" }, Later);

        result.Error.Code.ShouldBe(OrderRules.LockedCode);
    }

    private static string ExpenseTooLarge => Csps.Domain.Expenses.ExpenseRules.AmountTooLarge;

    private static Order Legacy(
        IReadOnlyList<NewOrderItem>? items = null,
        IReadOnlyList<NewOrderDiscount>? discounts = null,
        IReadOnlyList<NewOrderPayment>? payments = null,
        IReadOnlyList<NewOrderRefund>? refunds = null,
        IReadOnlyList<NewOrderExpense>? expenses = null,
        OrderStatus status = OrderStatus.InProduction,
        OrderDetails? details = null)
    {
        var snapshot = new OrderImportSnapshot("ORD-2026-0148", details ?? Details(), status, items ?? [Item(quantity: 15, unitPrice: 650.00m)])
        {
            Discounts = discounts ?? [],
            Payments = payments ?? [],
            Refunds = refunds ?? [],
            Expenses = expenses ?? [],
        };
        return Order.Import(snapshot, OrderImportRules.Default, Now).Value;
    }

    private static OrderDetails Details() =>
        new("Juan Dela Cruz", "Brgy. San Roque Ballers", "0917 123 4567", "juan.dc@example.com", "Brgy. San Roque", Today.AddDays(-10), Today.AddDays(4), "Rush");

    private static NewOrderItem Item(int quantity, decimal unitPrice) => new(JerseyType, "Jersey top", "S-XL", quantity, unitPrice);

    private static NewOrderPayment Payment(decimal amount) => new(Today.AddDays(-3), amount, Cash, null, null, Admin);

    private static NewOrderRefund Refund(decimal amount) => new(Today.AddDays(-1), amount, "Order changed", Admin);

    private static NewOrderExpense Expense(decimal amount) => new(Today.AddDays(-2), amount, Fabric, "Dri-fit mesh", Admin);
}
