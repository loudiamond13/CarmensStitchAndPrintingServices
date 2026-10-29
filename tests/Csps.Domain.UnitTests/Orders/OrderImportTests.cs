using Csps.Domain.Common;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>
/// ORD-21, D-14, D-22, D-40: a legacy order is built from its children with the figures worked out by OrderMath. Every relaxation is
/// a named value: the default rules accept the data and the strict rules refuse the same data, so each one is proven to matter.
/// The structural rules hold under every rules instance.
/// </summary>
public sealed class OrderImportTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 28);
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid Cash = Guid.Parse("01a17fce-7806-77e1-91b7-d3b852f2fd1d");
    private static readonly Guid Fabric = Guid.Parse("01a17fce-780b-75d1-89e0-5b3b9b185a2c");
    private static readonly Guid Admin = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid Manager = Guid.Parse("2f9a6d10-58b3-4c7e-8a41-d03e7b95c628");

    // Each row is a snapshot that breaks one rule. The rules instance named in the test decides whether it is accepted.
    private static readonly Case[] Relaxations =
    [
        new("KeepLegacyNumber", Valid() with { Number = "CSPS-77" }, "number"),
        new("DueDateOptional", Valid() with { Details = Details() with { DueDate = null } }, "dueDate"),
        new("ContactNumberOptional", Valid() with { Details = Details() with { ContactNumber = null } }, "contactNumber"),
        new("AllowOverpaid", Valid() with { Payments = [Payment(10000.00m)] }, "payments"),
        new("AllowCompletedWithBalance", Valid() with { Status = OrderStatus.Completed, Payments = [Payment(9250.00m)] }, "status"),
        new("AllowDiscountAboveSubtotal", Valid() with { Discounts = [new NewOrderDiscount(DiscountKind.Fixed, 10000.00m, "Team deal")] }, "discounts"),
        new("IgnoreAmountCaps payment", Valid() with { Payments = [Payment(2_000_000.00m)] }, "payments[0].amount"),
        new("IgnoreAmountCaps unit price", Valid() with { Items = [Item(unitPrice: 1_000_000.01m)] }, "items[0].unitPrice"),
        new("IgnoreAmountCaps quantity above", Valid() with { Items = [Item(quantity: 10_001)] }, "items[0].quantity"),
        new("IgnoreAmountCaps quantity zero", Valid() with { Items = [Item(quantity: 0)] }, "items[0].quantity"),
        new("IgnoreAmountCaps fixed discount", Valid() with { Discounts = [new NewOrderDiscount(DiscountKind.Fixed, 1_000_000.01m, "Team deal")] }, "discounts[0].value"),
        new("IgnoreAmountCaps percent discount", Valid() with { Discounts = [new NewOrderDiscount(DiscountKind.Percentage, 100.01m, "Team deal")] }, "discounts[0].value"),
        new("IgnoreAmountCaps refund", Valid() with { Refunds = [Refund(1_000_000.01m)] }, "refunds[0].amount"),
        new("IgnoreAmountCaps expense", Valid() with { Expenses = [Expense(1_000_000.01m)] }, "expenses[0].amount"),
        new("AllowFutureDates payment", Valid() with { Payments = [Payment(100.00m) with { PaymentDate = Today.AddDays(1) }] }, "payments[0].paymentDate"),
        new("AllowFutureDates refund", Valid() with { Refunds = [Refund(100.00m) with { RefundDate = Today.AddDays(1) }] }, "refunds[0].refundDate"),
        new("AllowFutureDates expense", Valid() with { Expenses = [Expense(100.00m) with { ExpenseDate = Today.AddDays(31) }] }, "expenses[0].expenseDate"),
        new("AllowAnyStatusHistory", Valid() with { StatusHistory = [new ImportedStatusChange(OrderStatus.Cancelled, OrderStatus.Completed, Admin, Now)] }, "statusHistory[0]"),
        new("IgnoreChildCaps items", Valid() with { Items = Enumerable.Repeat(Item(), 101).ToList() }, "items"),
        new("IgnoreChildCaps discounts", Valid() with { Discounts = Enumerable.Repeat(new NewOrderDiscount(DiscountKind.Fixed, 1.00m, "Team deal"), 21).ToList() }, "discounts"),
        new("IgnoreChildCaps payments", Valid() with { Payments = Enumerable.Repeat(Payment(1.00m), 101).ToList() }, "payments"),
        new("IgnoreChildCaps refunds", Valid() with { Refunds = Enumerable.Repeat(Refund(1.00m), 51).ToList() }, "refunds"),
        new("IgnoreChildCaps expenses", Valid() with { Expenses = Enumerable.Repeat(Expense(1.00m), 101).ToList() }, "expenses"),
        new("AllowNoItems", Valid() with { Items = [] }, "items"),
    ];

    // Each row breaks a structural rule: refused whatever the rules say.
    private static readonly Case[] Structural =
    [
        new("empty number", Valid() with { Number = string.Empty }, "number"),
        new("blank number", Valid() with { Number = "   " }, "number"),
        new("33 character number", Valid() with { Number = new string('A', 33) }, "number"),
        new("number with a letter outside plain text", Valid() with { Number = "ORD-é-1" }, "number"),
        new("status 0", Valid() with { Status = 0 }, "status"),
        new("status 8", Valid() with { Status = (OrderStatus)8 }, "status"),
        new("discount kind 0", Valid() with { Discounts = [new NewOrderDiscount(0, 10.00m, "Team deal")] }, "discounts[0].kind"),
        new("discount value 0", Valid() with { Discounts = [new NewOrderDiscount(DiscountKind.Fixed, 0.00m, "Team deal")] }, "discounts[0].value"),
        new("discount value with three decimals", Valid() with { Discounts = [new NewOrderDiscount(DiscountKind.Fixed, 10.001m, "Team deal")] }, "discounts[0].value"),
        new("quantity -1", Valid() with { Items = [Item(quantity: -1)] }, "items[0].quantity"),
        new("unit price -0.01", Valid() with { Items = [Item(unitPrice: -0.01m)] }, "items[0].unitPrice"),
        new("unit price with three decimals", Valid() with { Items = [Item(unitPrice: 650.123m)] }, "items[0].unitPrice"),
        new("payment amount 0.00", Valid() with { Payments = [Payment(0.00m)] }, "payments[0].amount"),
        new("payment amount with three decimals", Valid() with { Payments = [Payment(10.005m)] }, "payments[0].amount"),
        new("refund amount 0.00", Valid() with { Refunds = [Refund(0.00m)] }, "refunds[0].amount"),
        new("refund with no reason", Valid() with { Refunds = [Refund(5.00m) with { Reason = "  " }] }, "refunds[0].reason"),
        new("expense amount 0.00", Valid() with { Expenses = [Expense(0.00m)] }, "expenses[0].amount"),
        new("customer name over its column", Valid() with { Details = Details() with { CustomerName = new string('J', 101) } }, "customerName"),
        new("item description over its column", Valid() with { Items = [Item() with { Description = new string('d', 201) }] }, "items[0].description"),
        new("payment reference over its column", Valid() with { Payments = [Payment(5.00m) with { Reference = new string('r', 101) }] }, "payments[0].reference"),
        new("history to status 0", Valid() with { StatusHistory = [new ImportedStatusChange(null, 0, Admin, Now)] }, "statusHistory[0].toStatus"),
        new("history from status 9", Valid() with { StatusHistory = [new ImportedStatusChange((OrderStatus)9, OrderStatus.Pending, Admin, Now)] }, "statusHistory[0].fromStatus"),
    ];

    [Fact]
    public void AValidSnapshotIsAcceptedUnderTheStrictRulesToo()
    {
        Order.Import(Valid(), OrderImportRules.Strict, Now, Today).IsSuccess.ShouldBeTrue();
        Order.Import(Valid(), OrderImportRules.Default, Now).IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public void EveryRelaxationIsAcceptedByTheDefaultRulesAndRefusedByTheStrictRulesOnTheSameField()
    {
        foreach (var relaxation in Relaxations)
        {
            var strict = Order.Import(relaxation.Snapshot, OrderImportRules.Strict, Now, Today);
            ShouldRefuseOn(strict, relaxation.Path, relaxation.Name);

            var lenient = Order.Import(relaxation.Snapshot, OrderImportRules.Default, Now, Today);
            lenient.IsSuccess.ShouldBeTrue(relaxation.Name);
            AssertTotalsMatchOrderMath(lenient.Value);
        }
    }

    [Fact]
    public void EachRelaxationIsASingleNamedValueSoOneOffRulesOnlyLiftThatOneRule()
    {
        var lifted = new (string Name, OrderImportRules Rules)[]
        {
            ("KeepLegacyNumber", OrderImportRules.Strict with { KeepLegacyNumber = true }),
            ("DueDateOptional", OrderImportRules.Strict with { DueDateOptional = true }),
            ("ContactNumberOptional", OrderImportRules.Strict with { ContactNumberOptional = true }),
            ("AllowOverpaid", OrderImportRules.Strict with { AllowOverpaid = true }),
            ("AllowCompletedWithBalance", OrderImportRules.Strict with { AllowCompletedWithBalance = true }),
            ("AllowDiscountAboveSubtotal", OrderImportRules.Strict with { AllowDiscountAboveSubtotal = true, AllowOverpaid = true }),
            ("IgnoreAmountCaps payment", OrderImportRules.Strict with { IgnoreAmountCaps = true, AllowOverpaid = true }),
            ("AllowFutureDates payment", OrderImportRules.Strict with { AllowFutureDates = true }),
            ("AllowAnyStatusHistory", OrderImportRules.Strict with { AllowAnyStatusHistory = true }),
            ("IgnoreChildCaps items", OrderImportRules.Strict with { IgnoreChildCaps = true }),
            ("AllowNoItems", OrderImportRules.Strict with { AllowNoItems = true }),
        };

        foreach (var (name, rules) in lifted)
        {
            var relaxation = Relaxations.First(row => row.Name == name);

            Order.Import(relaxation.Snapshot, rules, Now, Today).IsSuccess.ShouldBeTrue(name);
        }
    }

    [Fact]
    public void TheStructuralRulesRefuseUnderEveryRulesInstance()
    {
        foreach (var broken in Structural)
        {
            ShouldRefuseOn(Order.Import(broken.Snapshot, OrderImportRules.Default, Now, Today), broken.Path, $"default: {broken.Name}");
            ShouldRefuseOn(Order.Import(broken.Snapshot, OrderImportRules.Strict, Now, Today), broken.Path, $"strict: {broken.Name}");
        }
    }

    [Fact]
    public void ANegativeQuantityOrPriceHasItsOwnMessageOnceTheLimitsAreSkipped()
    {
        var quantity = Valid() with { Items = [Item(quantity: -1)] };
        var price = Valid() with { Items = [Item(unitPrice: -0.01m)] };

        MessageOf(Order.Import(quantity, OrderImportRules.Default, Now), "items[0].quantity").ShouldBe("The quantity can't be negative.");
        MessageOf(Order.Import(quantity, OrderImportRules.Strict, Now, Today), "items[0].quantity").ShouldBe(OrderRules.QuantityOutOfRange);
        MessageOf(Order.Import(price, OrderImportRules.Default, Now), "items[0].unitPrice").ShouldBe("The unit price can't be negative.");
        MessageOf(Order.Import(price, OrderImportRules.Strict, Now, Today), "items[0].unitPrice").ShouldBe(OrderRules.UnitPriceOutOfRange);
    }

    [Fact]
    public void ARefusalReusesTheNormalRulesWordsForTheSameBreak()
    {
        var overpaid = Valid() with { Payments = [Payment(10000.00m)] };
        var completed = Valid() with { Status = OrderStatus.Completed, Payments = [Payment(9250.00m)] };
        var credit = Valid() with { Status = OrderStatus.Completed, Payments = [Payment(9950.00m)] };

        MessageOf(Order.Import(overpaid, OrderImportRules.Strict, Now, Today), "payments").ShouldBe(OrderRules.PaymentsAboveTotalMessage);
        MessageOf(Order.Import(completed, OrderImportRules.Strict, Now, Today), "status").ShouldBe(OrderStatusRules.CompleteBalanceOwedMessage(500.00m));
        MessageOf(Order.Import(Valid() with { Discounts = [new NewOrderDiscount(DiscountKind.Fixed, 10000.00m, "Team deal")] }, OrderImportRules.Strict, Now, Today), "discounts")
            .ShouldBe(OrderRules.DiscountAboveSubtotalMessage);
        MessageOf(Order.Import(credit, OrderImportRules.Strict with { AllowOverpaid = true }, Now, Today), "status").ShouldBe(OrderStatusRules.CompleteCreditMessage(200.00m));
        MessageOf(Order.Import(Valid() with { Number = "CSPS-77" }, OrderImportRules.Strict, Now, Today), "number").ShouldBe("Use the form ORD-2026-0001 for the order number.");
    }

    [Fact]
    public void TheStrictRulesNeedTheBusinessToday()
    {
        Should.Throw<ArgumentException>(() => Order.Import(Valid(), OrderImportRules.Strict, Now));
    }

    [Fact]
    public void AnOverpaidLegacyOrderKeepsEveryPaymentAndShowsTheExcessAsCustomerCredit()
    {
        var order = Order.Import(Valid() with { Payments = [Payment(6000.00m), Payment(4000.00m)] }, OrderImportRules.Default, Now).Value;

        order.PaidTotal.ShouldBe(10000.00m);
        order.Payments.Count.ShouldBe(2);
        order.Balance.ShouldBe(-250.00m);
        order.CustomerCredit.ShouldBe(250.00m);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void ACompletedLegacyOrderWithABalanceStaysCompletedAndLocked()
    {
        var order = Order.Import(Valid() with { Status = OrderStatus.Completed, Payments = [Payment(9250.00m)] }, OrderImportRules.Default, Now).Value;

        order.Status.ShouldBe(OrderStatus.Completed);
        order.Balance.ShouldBe(500.00m);
        var refused = order.AddItem(new NewOrderItem(JerseyType, "Extra", null, 1, 10.00m), Now);
        refused.Error.Code.ShouldBe(OrderRules.LockedCode);
    }

    [Fact]
    public void ALegacyOrderWithoutADueDateOrContactNumberKeepsThemEmpty()
    {
        var order = Order.Import(Valid() with { Details = Details() with { DueDate = null, ContactNumber = "  " } }, OrderImportRules.Default, Now).Value;

        order.DueDate.ShouldBeNull();
        order.ContactNumber.ShouldBeNull();
    }

    [Fact]
    public void TheNumberIsKeptExactlyAsGiven()
    {
        Order.Import(Valid() with { Number = "CSPS-77" }, OrderImportRules.Default, Now).Value.Number.ShouldBe("CSPS-77");
        Order.Import(Valid() with { Number = "ORD-2026-0148" }, OrderImportRules.Strict, Now, Today).Value.Number.ShouldBe("ORD-2026-0148");
        Order.Import(Valid() with { Number = new string('X', 32) }, OrderImportRules.Default, Now).Value.Number.Length.ShouldBe(32);
    }

    [Fact]
    public void TextIsTrimmedAndEmptyOptionalTextBecomesNullLikeAnyOtherOrder()
    {
        var details = Details() with { CustomerName = "  Juan Dela Cruz ", TeamName = " ", Email = "", Address = " Brgy. San Roque ", Notes = "\t" };
        var snapshot = Valid() with
        {
            Details = details,
            Items = [Item() with { Description = "  Jersey top ", SizeVariant = " " }],
            Payments = [Payment(5.00m) with { Reference = " ", Notes = " paid " }],
        };

        var order = Order.Import(snapshot, OrderImportRules.Default, Now).Value;

        order.CustomerName.ShouldBe("Juan Dela Cruz");
        order.TeamName.ShouldBeNull();
        order.Email.ShouldBeNull();
        order.Address.ShouldBe("Brgy. San Roque");
        order.Notes.ShouldBeNull();
        order.Items[0].Description.ShouldBe("Jersey top");
        order.Items[0].SizeVariant.ShouldBeNull();
        order.Payments[0].Reference.ShouldBeNull();
        order.Payments[0].Notes.ShouldBe("paid");
    }

    [Fact]
    public void EveryChildKeepsItsListPositionItsOrderAndItsPeople()
    {
        var snapshot = Valid() with
        {
            Items = [Item(), Item() with { Description = "Shorts" }],
            Discounts = [new NewOrderDiscount(DiscountKind.Percentage, 5m, "League"), new NewOrderDiscount(DiscountKind.Fixed, 50.00m, "Friend")],
            Payments = [Payment(100.00m), Payment(200.00m) with { ReceivedByUserId = Manager }],
            Refunds = [Refund(10.00m)],
            Expenses = [Expense(300.00m), Expense(400.00m) with { PaidByUserId = Manager }],
        };

        var order = Order.Import(snapshot, OrderImportRules.Default, Now).Value;

        order.Items.Select(item => item.Position).ShouldBe([0, 1]);
        order.Discounts.Select(discount => discount.Position).ShouldBe([0, 1]);
        order.Payments.Select(payment => (payment.Position, payment.ReceivedByUserId)).ShouldBe([(0, Admin), (1, Manager)]);
        order.Refunds.Select(refund => (refund.Position, refund.RefundedByUserId)).ShouldBe([(0, Admin)]);
        order.Expenses.Select(expense => (expense.Position, expense.PaidByUserId)).ShouldBe([(0, Admin), (1, Manager)]);
        order.Items.ShouldAllBe(item => item.Order == order && item.OrderId == order.Id && item.Id.Version == 7);
        order.Id.Version.ShouldBe(7);
        order.EditVersion.Version.ShouldBe(7);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void WithNoHistoryOneRowIsWrittenFromNothingToTheStatusAtTheImportTime()
    {
        var order = Order.Import(Valid() with { Status = OrderStatus.Ready }, OrderImportRules.Default, Now).Value;

        var change = order.StatusChanges.ShouldHaveSingleItem();
        change.FromStatus.ShouldBeNull();
        change.ToStatus.ShouldBe(OrderStatus.Ready);
        change.ChangedById.ShouldBeNull();
        change.ChangedAtUtc.ShouldBe(Now);
        change.Order.ShouldBeSameAs(order);
        order.StatusChangedAtUtc.ShouldBe(Now);
    }

    [Fact]
    public void AGivenHistoryIsKeptAsGivenAndTheStatusChangedTimeIsTheLatestRow()
    {
        var first = new DateTimeOffset(2026, 9, 1, 2, 0, 0, TimeSpan.Zero);
        var second = new DateTimeOffset(2026, 9, 20, 2, 0, 0, TimeSpan.Zero);
        var snapshot = Valid() with
        {
            Status = OrderStatus.InProduction,
            StatusHistory =
            [
                new ImportedStatusChange(null, OrderStatus.Pending, Manager, first),
                new ImportedStatusChange(OrderStatus.Pending, OrderStatus.InProduction, null, second),
            ],
        };

        var order = Order.Import(snapshot, OrderImportRules.Strict, Now, Today).Value;

        order.StatusChanges.Select(change => (change.FromStatus, change.ToStatus, change.ChangedById, change.ChangedAtUtc))
            .ShouldBe([(null, OrderStatus.Pending, (Guid?)Manager, first), (OrderStatus.Pending, OrderStatus.InProduction, null, second)]);
        order.StatusChangedAtUtc.ShouldBe(second);
    }

    [Fact]
    public void ACancelledLegacyOrderUsesTheCancelledProfitRule()
    {
        var snapshot = Valid() with { Status = OrderStatus.Cancelled, Payments = [Payment(1000.00m)], Refunds = [Refund(400.00m)], Expenses = [Expense(100.00m)] };

        var order = Order.Import(snapshot, OrderImportRules.Default, Now).Value;

        order.Profit.ShouldBe(500.00m);
        AssertTotalsMatchOrderMath(order);
    }

    private static void ShouldRefuseOn(Result<Order> result, string path, string context)
    {
        result.IsFailure.ShouldBeTrue(context);
        result.Error.Kind.ShouldBe(ErrorKind.Validation, context);
        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe([path], context);
    }

    private static string MessageOf(Result<Order> result, string path)
    {
        result.IsFailure.ShouldBeTrue();
        return result.Error.FieldErrors.ShouldNotBeNull()[path].ShouldHaveSingleItem();
    }

    private static void AssertTotalsMatchOrderMath(Order order)
    {
        var expected = OrderMath.Compute(
            [.. order.Items.Select(item => new OrderMathItem(item.Quantity, item.UnitPrice))],
            [.. order.Discounts.Select(discount => new OrderMathDiscount(discount.Kind, discount.Value))],
            [.. order.Payments.Select(payment => payment.Amount)],
            [.. order.Refunds.Select(refund => refund.Amount)],
            [.. order.Expenses.Select(expense => expense.Amount)],
            order.Status == OrderStatus.Cancelled);
        order.Subtotal.ShouldBe(expected.Subtotal);
        order.DiscountTotal.ShouldBe(expected.Discount);
        order.Total.ShouldBe(expected.Total);
        order.PaidTotal.ShouldBe(expected.Paid);
        order.RefundedTotal.ShouldBe(expected.Refunded);
        order.Balance.ShouldBe(expected.Balance);
        order.CustomerCredit.ShouldBe(expected.CustomerCredit);
        order.ExpensesTotal.ShouldBe(expected.Expenses);
        order.Profit.ShouldBe(expected.Profit);
        order.FullyPaid.ShouldBe(expected.FullyPaid);
    }

    private static OrderDetails Details() =>
        new("Juan Dela Cruz", "Brgy. San Roque Ballers", "0917 123 4567", "juan.dc@example.com", "Brgy. San Roque", Today.AddDays(-10), Today.AddDays(4), "Rush");

    private static NewOrderItem Item(int quantity = 15, decimal unitPrice = 650.00m) =>
        new(JerseyType, "Jersey top", "S-XL", quantity, unitPrice);

    private static NewOrderPayment Payment(decimal amount) =>
        new(Today.AddDays(-3), amount, Cash, null, null, Admin);

    private static NewOrderRefund Refund(decimal amount) =>
        new(Today.AddDays(-1), amount, "Order changed", Admin);

    private static NewOrderExpense Expense(decimal amount) =>
        new(Today.AddDays(-2), amount, Fabric, null, Admin);

    // 15 jerseys at 650.00 is a subtotal of 9,750.00.
    private static OrderImportSnapshot Valid() =>
        new("ORD-2026-0148", Details(), OrderStatus.InProduction, [Item()]);

    private sealed record Case(string Name, OrderImportSnapshot Snapshot, string Path);
}
