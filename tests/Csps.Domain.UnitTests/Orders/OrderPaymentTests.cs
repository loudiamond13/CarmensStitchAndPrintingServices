using Csps.Domain.Common;
using Csps.Domain.Expenses;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>D-11, D-12, D-30, ORD-05, ORD-22: payments re-check every rule, never pass the balance, and other changes may leave a customer credit.</summary>
public sealed class OrderPaymentTests
{
    private static readonly DateTimeOffset Created = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = new(2026, 10, 29, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 28);
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid Cash = Guid.Parse("01a17fce-7806-77e1-91b7-d3b852f2fd1d");
    private static readonly Guid GCash = Guid.Parse("01a17fce-7807-751a-bb7b-3719f2840928");
    private static readonly Guid Admin = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid Manager = Guid.Parse("2f9a6d10-58b3-4c7e-8a41-d03e7b95c628");

    private static readonly (string Path, string Message, NewOrderPayment Payment)[] BrokenPayments =
    [
        ("paymentMethodId", OrderRules.PaymentMethodRequired, new NewOrderPayment(Today, 100m, Guid.Empty, null, null, Admin)),
        ("paymentDate", OrderRules.PaymentDateInFuture, new NewOrderPayment(Today.AddDays(1), 100m, Cash, null, null, Admin)),
        ("amount", OrderRules.PaymentAmountOutOfRange, new NewOrderPayment(Today, 0m, Cash, null, null, Admin)),
        ("amount", OrderRules.PaymentAmountOutOfRange, new NewOrderPayment(Today, -1m, Cash, null, null, Admin)),
        ("amount", OrderRules.PaymentAmountOutOfRange, new NewOrderPayment(Today, 1_000_000.01m, Cash, null, null, Admin)),
        ("amount", OrderRules.MoneyDecimals, new NewOrderPayment(Today, 0.001m, Cash, null, null, Admin)),
        ("reference", OrderRules.PaymentReferenceTooLong, new NewOrderPayment(Today, 100m, Cash, new string('r', 101), null, Admin)),
        ("notes", OrderRules.PaymentNotesTooLong, new NewOrderPayment(Today, 100m, Cash, null, new string('n', 501), Admin)),
        ("receivedByUserId", OrderRules.ReceivedByRequired, new NewOrderPayment(Today, 100m, Cash, null, null, Guid.Empty)),
    ];

    [Fact]
    public void AddingPaymentsRecomputesThePaidTotalAndTheBalanceThroughOrderMath()
    {
        var order = Ord0148Discounted();
        var editVersion = order.EditVersion;

        var first = order.AddPayment(new NewOrderPayment(Today.AddDays(-3), 10000.00m, GCash, "  9012 345 678901 ", " 50% downpayment ", Admin), Today, Later);
        var second = order.AddPayment(new NewOrderPayment(Today.AddDays(-1), 2000.00m, Cash, null, null, Manager), Today, Later);

        first.IsSuccess.ShouldBeTrue();
        first.Value.Reference.ShouldBe("9012 345 678901");
        first.Value.Notes.ShouldBe("50% downpayment");
        first.Value.Position.ShouldBe(0);
        first.Value.OrderId.ShouldBe(order.Id);
        first.Value.Order.ShouldBeSameAs(order);
        second.Value.Position.ShouldBe(1);
        second.Value.Reference.ShouldBeNull();
        order.Payments.Count.ShouldBe(2);
        order.PaidTotal.ShouldBe(12000.00m);
        order.Balance.ShouldBe(9327.50m);
        order.Profit.ShouldBe(21327.50m);
        order.CustomerCredit.ShouldBe(0.00m);
        order.EditVersion.ShouldNotBe(editVersion);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void AnAmountEqualToTheBalanceIsAcceptedAndOneCentavoMoreIsRefusedWithTheBalanceMessage()
    {
        var order = Ord0148Discounted();

        var over = order.AddPayment(new NewOrderPayment(Today, 21327.51m, Cash, null, null, Admin), Today, Later);
        var editVersion = order.EditVersion;
        var exact = order.AddPayment(new NewOrderPayment(Today, 21327.50m, Cash, null, null, Admin), Today, Later);

        over.IsFailure.ShouldBeTrue();
        over.Error.Kind.ShouldBe(ErrorKind.Validation);
        var fields = over.Error.FieldErrors.ShouldNotBeNull();
        fields.Keys.ShouldBe(["amount"]);
        fields["amount"].ShouldBe(["This is more than the balance. Enter ₱21,327.50 or less."]);
        exact.IsSuccess.ShouldBeTrue();
        order.Balance.ShouldBe(0.00m);
        order.FullyPaid.ShouldBeTrue();
        order.EditVersion.ShouldNotBe(editVersion);
    }

    [Fact]
    public void ARefusedPaymentChangesNothing()
    {
        var order = Ord0148();
        var editVersion = order.EditVersion;

        var result = order.AddPayment(new NewOrderPayment(Today, 99999m, Cash, null, null, Admin), Today, Later);

        result.IsFailure.ShouldBeTrue();
        order.Payments.ShouldBeEmpty();
        order.PaidTotal.ShouldBe(0m);
        order.Balance.ShouldBe(22450.00m);
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void WhenNothingIsOwedAnyPaymentIsRefusedWithTheNothingOwedMessage()
    {
        var order = Ord0148();
        order.AddPayment(new NewOrderPayment(Today, 22450.00m, Cash, null, null, Admin), Today, Later).IsSuccess.ShouldBeTrue();

        var result = order.AddPayment(new NewOrderPayment(Today, 0.01m, Cash, null, null, Admin), Today, Later);

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors.ShouldNotBeNull()["amount"].ShouldBe(["Nothing is owed on this order."]);
    }

    [Fact]
    public void WhenTheOrderIsInCreditAnyPaymentIsRefusedWithTheNothingOwedMessage()
    {
        var order = Ord0148();
        order.AddPayment(new NewOrderPayment(Today, 22450.00m, Cash, null, null, Admin), Today, Later).IsSuccess.ShouldBeTrue();
        order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 500m, "Goodwill"), Later).IsSuccess.ShouldBeTrue();

        var result = order.AddPayment(new NewOrderPayment(Today, 1m, Cash, null, null, Admin), Today, Later);

        order.Balance.ShouldBe(-500m);
        result.Error.FieldErrors.ShouldNotBeNull()["amount"].ShouldBe([OrderRules.NothingOwed]);
    }

    [Fact]
    public void EachBrokenPaymentFieldIsRefusedWithItsMessageAndNothingIsAdded()
    {
        foreach (var (path, message, broken) in BrokenPayments)
        {
            var order = Ord0148();
            var editVersion = order.EditVersion;

            var result = order.AddPayment(broken, Today, Later);

            result.IsFailure.ShouldBeTrue(message);
            result.Error.Kind.ShouldBe(ErrorKind.Validation, message);
            var fields = result.Error.FieldErrors.ShouldNotBeNull();
            fields.Keys.ShouldBe([path], message);
            fields[path].ShouldBe([message]);
            order.Payments.ShouldBeEmpty(message);
            order.EditVersion.ShouldBe(editVersion, message);
        }
    }

    [Theory]
    [InlineData(0.01)]
    [InlineData(1_000_000.00)]
    public void TheEdgeAmountsAreAccepted(double amount)
    {
        var order = OrderOf(new NewOrderItem(JerseyType, "Jersey top", null, 10_000, 100.00m));

        var result = order.AddPayment(new NewOrderPayment(Today, (decimal)amount, Cash, null, null, Admin), Today, Later);

        result.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public void ThePaymentDateOfTodayIsAcceptedAndTomorrowIsRefused()
    {
        var order = Ord0148();

        order.AddPayment(new NewOrderPayment(Today, 100m, Cash, null, null, Admin), Today, Later).IsSuccess.ShouldBeTrue();
        var tomorrow = order.AddPayment(new NewOrderPayment(Today.AddDays(1), 100m, Cash, null, null, Admin), Today, Later);

        tomorrow.Error.FieldErrors.ShouldNotBeNull()["paymentDate"].ShouldBe(["The payment date can't be in the future."]);
    }

    [Fact]
    public void AReferenceOfOneHundredAndNotesOfFiveHundredCharactersAreAccepted()
    {
        var order = Ord0148();

        var result = order.AddPayment(new NewOrderPayment(Today, 100m, Cash, new string('r', 100), new string('n', 500), Admin), Today, Later);

        result.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public void APaymentInAListIsReportedUnderItsPlaceInTheList()
    {
        var result = OrderRules.CheckPayment(1, new NewOrderPayment(Today, 100m, Cash, null, null, Guid.Empty), Today);

        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["payments[1].receivedByUserId"]);
        OrderRules.PaymentPath(null, "amount").ShouldBe("amount");
        OrderRules.PaymentPath(0, "amount").ShouldBe("payments[0].amount");
    }

    [Fact]
    public void AHundredAndFirstPaymentIsRefusedAndTheHundredthIsAccepted()
    {
        var order = Ord0148();
        for (var index = 0; index < 99; index++)
        {
            order.AddPayment(new NewOrderPayment(Today, 0.01m, Cash, null, null, Admin), Today, Later).IsSuccess.ShouldBeTrue();
        }

        var hundredth = order.AddPayment(new NewOrderPayment(Today, 0.01m, Cash, null, null, Admin), Today, Later);
        var editVersion = order.EditVersion;
        var next = order.AddPayment(new NewOrderPayment(Today, 0.01m, Cash, null, null, Admin), Today, Later.AddHours(1));

        hundredth.IsSuccess.ShouldBeTrue();
        next.IsFailure.ShouldBeTrue();
        next.Error.ShouldBe(OrderRules.TooManyPayments);
        next.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        next.Error.Code.ShouldBe("orders.too-many-payments");
        next.Error.Message.ShouldBe("An order can have at most 100 payments.");
        order.Payments.Count.ShouldBe(100);
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void UpdatingAPaymentReturnsTheOldAndNewPairsAndAReceiverChangeOnItsOwn()
    {
        var order = Ord0148();
        var payment = order.AddPayment(new NewOrderPayment(Today.AddDays(-3), 10000m, GCash, "ref", "note", Admin), Today, Later).Value;
        var editVersion = order.EditVersion;

        var result = order.UpdatePayment(
            payment.Id,
            new NewOrderPayment(Today.AddDays(-2), 9000m, Cash, "ref", "other note", Manager),
            Today,
            Later.AddHours(1));

        result.IsSuccess.ShouldBeTrue();
        var changes = result.Value;
        changes.HasAny.ShouldBeTrue();
        changes.Date.ShouldBe(new ValueChange<DateOnly>(Today.AddDays(-3), Today.AddDays(-2)));
        changes.Amount.ShouldBe(new ValueChange<decimal>(10000m, 9000m));
        changes.Method.ShouldBe(new ValueChange<Guid>(GCash, Cash));
        changes.Receiver.ShouldBe(new ValueChange<Guid>(Admin, Manager));
        changes.ChangedFields.ShouldBe(["notes"]);
        changes.HasFieldChange.ShouldBeTrue();
        payment.PaymentDate.ShouldBe(Today.AddDays(-2));
        payment.Amount.ShouldBe(9000m);
        payment.PaymentMethodId.ShouldBe(Cash);
        payment.ReceivedByUserId.ShouldBe(Manager);
        payment.Notes.ShouldBe("other note");
        order.PaidTotal.ShouldBe(9000m);
        order.Balance.ShouldBe(13450.00m);
        order.EditVersion.ShouldNotBe(editVersion);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void AReceiverOnlyChangeIsNotAFieldChange()
    {
        var order = Ord0148();
        var payment = order.AddPayment(new NewOrderPayment(Today, 100m, Cash, null, null, Admin), Today, Later).Value;

        var changes = order.UpdatePayment(payment.Id, new NewOrderPayment(Today, 100m, Cash, null, null, Manager), Today, Later.AddHours(1)).Value;

        changes.HasAny.ShouldBeTrue();
        changes.HasFieldChange.ShouldBeFalse();
        changes.Receiver.ShouldBe(new ValueChange<Guid>(Admin, Manager));
    }

    [Fact]
    public void ATextOnlyChangeNamesTheReferenceAndTheNotes()
    {
        var order = Ord0148();
        var payment = order.AddPayment(new NewOrderPayment(Today, 100m, Cash, "old", "old", Admin), Today, Later).Value;

        var changes = order.UpdatePayment(payment.Id, new NewOrderPayment(Today, 100m, Cash, "new", "new", Admin), Today, Later.AddHours(1)).Value;

        changes.ChangedFields.ShouldBe(["reference", "notes"]);
        changes.Receiver.ShouldBeNull();
        changes.HasFieldChange.ShouldBeTrue();
    }

    [Fact]
    public void AnEditThatChangesNothingKeepsTheOrderAndItsEditVersion()
    {
        var order = Ord0148();
        var payment = order.AddPayment(new NewOrderPayment(Today, 100m, Cash, "ref", "note", Admin), Today, Later).Value;
        var editVersion = order.EditVersion;

        var result = order.UpdatePayment(payment.Id, new NewOrderPayment(Today, 100m, Cash, " ref ", " note ", Admin), Today, Later.AddHours(1));

        result.IsSuccess.ShouldBeTrue();
        result.Value.HasAny.ShouldBeFalse();
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void AnEditMayLowerTheAmountFreelyEvenWhenTheOrderIsInCredit()
    {
        var order = Ord0148();
        var payment = order.AddPayment(new NewOrderPayment(Today, 22450.00m, Cash, null, null, Admin), Today, Later).Value;
        order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 500m, "Goodwill"), Later).IsSuccess.ShouldBeTrue();
        order.CustomerCredit.ShouldBe(500m);

        var result = order.UpdatePayment(payment.Id, new NewOrderPayment(Today, 22000.00m, Cash, null, null, Admin), Today, Later.AddHours(1));

        result.IsSuccess.ShouldBeTrue();
        order.PaidTotal.ShouldBe(22000.00m);
        order.Balance.ShouldBe(-50m);
        order.CustomerCredit.ShouldBe(50m);
    }

    [Fact]
    public void AnEditMayRaiseTheAmountUpToTheBalancePlusItsOldAmountAndNoFurther()
    {
        var order = Ord0148();
        var payment = order.AddPayment(new NewOrderPayment(Today, 10000m, Cash, null, null, Admin), Today, Later).Value;

        var over = order.UpdatePayment(payment.Id, new NewOrderPayment(Today, 22450.01m, Cash, null, null, Admin), Today, Later.AddHours(1));
        var editVersion = order.EditVersion;
        var exact = order.UpdatePayment(payment.Id, new NewOrderPayment(Today, 22450.00m, Cash, null, null, Admin), Today, Later.AddHours(1));

        over.IsFailure.ShouldBeTrue();
        over.Error.FieldErrors.ShouldNotBeNull()["amount"].ShouldBe(["This is more than the balance. Enter ₱22,450.00 or less."]);
        payment.Amount.ShouldBe(22450.00m);
        exact.IsSuccess.ShouldBeTrue();
        order.Balance.ShouldBe(0m);
        order.EditVersion.ShouldNotBe(editVersion);
    }

    [Fact]
    public void RaisingAPaymentWhenTheCreditIsLargerThanItIsRefusedWithNothingOwed()
    {
        var order = Ord0148();
        var payment = order.AddPayment(new NewOrderPayment(Today, 100m, Cash, null, null, Admin), Today, Later).Value;
        order.AddPayment(new NewOrderPayment(Today, 22350m, Cash, null, null, Admin), Today, Later).IsSuccess.ShouldBeTrue();
        order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 5000m, "Goodwill"), Later).IsSuccess.ShouldBeTrue();
        order.Balance.ShouldBe(-5000m);

        var result = order.UpdatePayment(payment.Id, new NewOrderPayment(Today, 101m, Cash, null, null, Admin), Today, Later.AddHours(1));

        result.Error.FieldErrors.ShouldNotBeNull()["amount"].ShouldBe([OrderRules.NothingOwed]);
        payment.Amount.ShouldBe(100m);
    }

    [Fact]
    public void EachBrokenFieldIsRefusedOnAnEditAndNothingChanges()
    {
        foreach (var (path, message, broken) in BrokenPayments)
        {
            var order = Ord0148();
            var payment = order.AddPayment(new NewOrderPayment(Today, 100m, Cash, null, null, Admin), Today, Later).Value;
            var editVersion = order.EditVersion;

            var result = order.UpdatePayment(payment.Id, broken, Today, Later.AddHours(1));

            result.IsFailure.ShouldBeTrue(message);
            result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe([path], message);
            payment.Amount.ShouldBe(100m, message);
            order.EditVersion.ShouldBe(editVersion, message);
        }
    }

    [Fact]
    public void UpdatingOrRemovingAPaymentThatIsNotOnTheOrderIsA404()
    {
        var order = Ord0148();
        var other = Ord0148();
        var foreign = other.AddPayment(new NewOrderPayment(Today, 100m, Cash, null, null, Admin), Today, Later).Value;
        var editVersion = order.EditVersion;

        var update = order.UpdatePayment(foreign.Id, new NewOrderPayment(Today, 100m, Cash, null, null, Admin), Today, Later);
        var remove = order.RemovePayment(foreign.Id, Later);

        update.Error.ShouldBe(OrderRules.PaymentNotFound);
        remove.Error.ShouldBe(OrderRules.PaymentNotFound);
        update.Error.Kind.ShouldBe(ErrorKind.NotFound);
        update.Error.Code.ShouldBe("orders.payment-not-found");
        update.Error.Message.ShouldBe("This payment was not found on this order.");
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void RemovingAPaymentRecomputesTheTotals()
    {
        var order = Ord0148();
        var first = order.AddPayment(new NewOrderPayment(Today, 10000m, Cash, null, null, Admin), Today, Later).Value;
        order.AddPayment(new NewOrderPayment(Today, 2000m, GCash, null, null, Manager), Today, Later).IsSuccess.ShouldBeTrue();
        var editVersion = order.EditVersion;

        var result = order.RemovePayment(first.Id, Later.AddHours(1));

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBeSameAs(first);
        order.Payments.ShouldHaveSingleItem().Amount.ShouldBe(2000m);
        order.PaidTotal.ShouldBe(2000m);
        order.Balance.ShouldBe(20450.00m);
        order.EditVersion.ShouldNotBe(editVersion);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void ANewPaymentAfterARemovalTakesThePlaceAfterTheHighest()
    {
        var order = Ord0148();
        order.AddPayment(new NewOrderPayment(Today, 100m, Cash, null, null, Admin), Today, Later).IsSuccess.ShouldBeTrue();
        var second = order.AddPayment(new NewOrderPayment(Today, 100m, Cash, null, null, Admin), Today, Later).Value;
        order.RemovePayment(order.Payments[0].Id, Later).IsSuccess.ShouldBeTrue();

        var third = order.AddPayment(new NewOrderPayment(Today, 100m, Cash, null, null, Admin), Today, Later).Value;

        second.Position.ShouldBe(1);
        third.Position.ShouldBe(2);
    }

    [Fact]
    public void AfterFullPaymentRemovingAnItemLeavesACustomerCreditEqualToPaidMinusTheNewTotal()
    {
        var order = OrderOf(new NewOrderItem(JerseyType, "Jersey top", "S-XL", 15, 650.00m), new NewOrderItem(JerseyType, "Coach polo", "L", 2, 550.00m));
        order.Total.ShouldBe(10850.00m);
        order.AddPayment(new NewOrderPayment(Today, 10850.00m, Cash, null, null, Admin), Today, Later).IsSuccess.ShouldBeTrue();

        var removed = order.RemoveItem(order.Items[1].Id, Later);

        removed.IsSuccess.ShouldBeTrue();
        order.Total.ShouldBe(9750.00m);
        order.PaidTotal.ShouldBe(10850.00m);
        order.Balance.ShouldBe(-1100.00m);
        order.CustomerCredit.ShouldBe(1100.00m);
        order.FullyPaid.ShouldBeTrue();
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void AfterFullPaymentALowerQuantityLeavesACustomerCredit()
    {
        var order = OrderOf(new NewOrderItem(JerseyType, "Jersey top", "S-XL", 15, 650.00m));
        order.AddPayment(new NewOrderPayment(Today, 9750.00m, Cash, null, null, Admin), Today, Later).IsSuccess.ShouldBeTrue();

        var lowered = order.UpdateItem(order.Items[0].Id, new NewOrderItem(JerseyType, "Jersey top", "S-XL", 10, 650.00m), Later);

        lowered.IsSuccess.ShouldBeTrue();
        order.Total.ShouldBe(6500.00m);
        order.CustomerCredit.ShouldBe(3250.00m);
        order.CustomerCredit.ShouldBe(order.PaidTotal - order.Total);
    }

    [Fact]
    public void AfterFullPaymentAFixedDiscountLeavesACustomerCreditOfTheDiscount()
    {
        var order = OrderOf(new NewOrderItem(JerseyType, "Jersey top", "S-XL", 15, 650.00m));
        order.Total.ShouldBe(9750.00m);
        order.AddPayment(new NewOrderPayment(Today, 9750.00m, Cash, null, null, Admin), Today, Later).IsSuccess.ShouldBeTrue();

        var discounted = order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 500.00m, "Goodwill"), Later);

        discounted.IsSuccess.ShouldBeTrue();
        order.Balance.ShouldBe(-500.00m);
        order.CustomerCredit.ShouldBe(500.00m);
    }

    [Fact]
    public void CreatingAnOrderWithPaymentsRecomputesThePaidTotalAndTheBalance()
    {
        var result = Create(
            [new NewOrderDiscount(DiscountKind.Percentage, 5m, "League")],
            [
                new NewOrderPayment(Today.AddDays(-3), 10000m, GCash, "9012 345 678901", "50% downpayment", Admin),
                new NewOrderPayment(Today.AddDays(-1), 2000m, Cash, null, null, Manager),
            ],
            Today);

        result.IsSuccess.ShouldBeTrue();
        var order = result.Value;
        order.Payments.Select(static payment => payment.Position).ShouldBe([0, 1]);
        order.Payments.ShouldAllBe(payment => payment.Order == order && payment.OrderId == order.Id);
        order.PaidTotal.ShouldBe(12000m);
        order.Balance.ShouldBe(9327.50m);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void PaymentsAddingUpToExactlyTheTotalAreAcceptedAndOneCentavoMoreIsRefusedOnPayments()
    {
        var exact = Create([new NewOrderDiscount(DiscountKind.Percentage, 5m, "League")], [new NewOrderPayment(Today, 21327.50m, Cash, null, null, Admin)], Today);
        var over = Create(
            [new NewOrderDiscount(DiscountKind.Percentage, 5m, "League")],
            [new NewOrderPayment(Today, 21000m, Cash, null, null, Admin), new NewOrderPayment(Today, 327.51m, Cash, null, null, Admin)],
            Today);

        exact.IsSuccess.ShouldBeTrue();
        exact.Value.Balance.ShouldBe(0m);
        over.IsFailure.ShouldBeTrue();
        var fields = over.Error.FieldErrors.ShouldNotBeNull();
        fields.Keys.ShouldBe(["payments"]);
        fields["payments"].ShouldBe(["The payments would be more than the order total. Lower a payment first."]);
    }

    [Fact]
    public void ABrokenPaymentInTheCreateBodyIsReportedUnderItsPlaceInTheList()
    {
        var result = Create(
            [],
            [new NewOrderPayment(Today, 100m, Cash, null, null, Admin), new NewOrderPayment(Today, 100m, Cash, null, null, Guid.Empty)],
            Today);

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["payments[1].receivedByUserId"]);
    }

    [Fact]
    public void AHundredAndFirstPaymentInTheCreateBodyIsRefusedOnPayments()
    {
        var many = Enumerable.Range(0, 101).Select(static _ => new NewOrderPayment(Today, 0.01m, Cash, null, null, Admin)).ToList();

        var result = Create([], many, Today);

        result.Error.FieldErrors.ShouldNotBeNull()["payments"].ShouldBe([OrderRules.PaymentsTooMany]);
    }

    [Fact]
    public void PaymentsWithoutTheBusinessTodayAreAProgrammingError()
    {
        Should.Throw<ArgumentException>(() => Create([], [new NewOrderPayment(Today, 100m, Cash, null, null, Admin)], today: null));
    }

    [Fact]
    public void ANullPaymentListIsAProgrammingError()
    {
        var details = new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null);
        var input = new NewOrder(details, OrderStatus.Pending, [new NewOrderItem(JerseyType, "Jersey top", null, 1, 10m)]) { Payments = null! };

        Should.Throw<ArgumentNullException>(() => Order.Create(input, Guid.NewGuid(), Created, Today));
    }

    private static Result<Order> Create(IReadOnlyList<NewOrderDiscount> discounts, IReadOnlyList<NewOrderPayment> payments, DateOnly? today)
    {
        var details = new OrderDetails("Juan Dela Cruz", "Brgy. San Roque Ballers", "0917 123 4567", null, null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null);
        var items = new[]
        {
            new NewOrderItem(JerseyType, "Jersey top", "S-XL", 15, 650.00m),
            new NewOrderItem(JerseyType, "Jersey shorts", "S-XL", 15, 300.00m),
            new NewOrderItem(JerseyType, "Coach polo", "L", 2, 550.00m),
            new NewOrderItem(JerseyType, "Warm-up long sleeves", "M-XL", 15, 420.00m),
            new NewOrderItem(JerseyType, "Team banner", null, 1, 800.00m),
        };
        return Order.Create(new NewOrder(details, OrderStatus.Pending, items) { Discounts = discounts, Payments = payments }, Guid.NewGuid(), Created, today);
    }

    private static Order Ord0148Discounted()
    {
        var order = Ord0148();
        order.AddDiscount(new NewOrderDiscount(DiscountKind.Percentage, 5m, "League"), Created).IsSuccess.ShouldBeTrue();
        return order;
    }

    private static Order Ord0148() => OrderOf(
        new NewOrderItem(JerseyType, "Jersey top", "S-XL", 15, 650.00m),
        new NewOrderItem(JerseyType, "Jersey shorts", "S-XL", 15, 300.00m),
        new NewOrderItem(JerseyType, "Coach polo", "L", 2, 550.00m),
        new NewOrderItem(JerseyType, "Warm-up long sleeves", "M-XL", 15, 420.00m),
        new NewOrderItem(JerseyType, "Team banner", null, 1, 800.00m));

    private static Order OrderOf(params NewOrderItem[] items)
    {
        var details = new OrderDetails("Juan Dela Cruz", "Brgy. San Roque Ballers", "0917 123 4567", "juan.dc@example.com", null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null);
        return Order.Create(new NewOrder(details, OrderStatus.Pending, items), Guid.NewGuid(), Created).Value;
    }

    private static void AssertTotalsMatchOrderMath(Order order)
    {
        var figures = OrderMath.Compute(
            [.. order.Items.Select(static item => new OrderMathItem(item.Quantity, item.UnitPrice))],
            [.. order.Discounts.Select(static discount => new OrderMathDiscount(discount.Kind, discount.Value))],
            [.. order.Payments.Select(static payment => payment.Amount)],
            [],
            [],
            cancelled: false);
        order.Subtotal.ShouldBe(figures.Subtotal);
        order.DiscountTotal.ShouldBe(figures.Discount);
        order.Total.ShouldBe(figures.Total);
        order.PaidTotal.ShouldBe(figures.Paid);
        order.Balance.ShouldBe(figures.Balance);
        order.CustomerCredit.ShouldBe(figures.CustomerCredit);
        order.Profit.ShouldBe(figures.Profit);
        order.FullyPaid.ShouldBe(figures.FullyPaid);
    }
}
