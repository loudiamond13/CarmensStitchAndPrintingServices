using Csps.Domain.Common;
using Csps.Domain.Expenses;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>D-17, D-30, ORD-05, ORD-23: order expenses re-check every rule, never touch the balance and move the profit through OrderMath.</summary>
public sealed class OrderExpenseTests
{
    private static readonly DateTimeOffset Created = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = new(2026, 10, 29, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 28);
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid Cash = Guid.Parse("01a17fce-7806-77e1-91b7-d3b852f2fd1d");
    private static readonly Guid Fabric = Guid.Parse("01a17fce-780b-75d1-89e0-5b3b9b185a2c");
    private static readonly Guid Ink = Guid.Parse("01a17fce-780c-73e0-b847-33f866e42d3d");
    private static readonly Guid Outsourcing = Guid.Parse("01a17fce-780d-75c8-b20b-2b2cc64dddfa");
    private static readonly Guid Admin = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid Manager = Guid.Parse("2f9a6d10-58b3-4c7e-8a41-d03e7b95c628");

    private static readonly (string Path, string Message, NewOrderExpense Expense)[] BrokenExpenses =
    [
        ("orderExpenseCategoryId", "Choose a category.", new NewOrderExpense(Today, 100m, Guid.Empty, null, Admin)),
        ("expenseDate", "Choose a date up to 30 days from today, Nov 27, 2026 at the latest.", new NewOrderExpense(Today.AddDays(31), 100m, Fabric, null, Admin)),
        ("amount", ExpenseRules.AmountTooSmall, new NewOrderExpense(Today, 0m, Fabric, null, Admin)),
        ("amount", ExpenseRules.AmountTooSmall, new NewOrderExpense(Today, -1m, Fabric, null, Admin)),
        ("amount", ExpenseRules.AmountTooLarge, new NewOrderExpense(Today, 1_000_000.01m, Fabric, null, Admin)),
        ("amount", ExpenseRules.AmountDecimals, new NewOrderExpense(Today, 0.001m, Fabric, null, Admin)),
        ("description", ExpenseRules.DescriptionTooLong, new NewOrderExpense(Today, 100m, Fabric, new string('d', 201), Admin)),
        ("paidByUserId", "Choose who paid.", new NewOrderExpense(Today, 100m, Fabric, null, Guid.Empty)),
    ];

    [Fact]
    public void AddingExpensesRecomputesTheExpensesAndTheProfitThroughOrderMathAndLeavesTheBalanceAlone()
    {
        var order = Ord0148Discounted();
        var editVersion = order.EditVersion;
        var balance = order.Balance;

        var first = order.AddExpense(new NewOrderExpense(Today.AddDays(-5), 3825.00m, Fabric, "  Dri-fit mesh, 45 yds ", Manager), Today, Later);
        var second = order.AddExpense(new NewOrderExpense(Today.AddDays(-2), 1640.00m, Ink, null, Admin), Today, Later);
        var third = order.AddExpense(new NewOrderExpense(Today, 600.00m, Outsourcing, "   ", Admin), Today, Later);

        first.IsSuccess.ShouldBeTrue();
        first.Value.Description.ShouldBe("Dri-fit mesh, 45 yds");
        first.Value.Position.ShouldBe(0);
        first.Value.OrderId.ShouldBe(order.Id);
        first.Value.Order.ShouldBeSameAs(order);
        first.Value.PaidByUserId.ShouldBe(Manager);
        second.Value.Position.ShouldBe(1);
        second.Value.Description.ShouldBeNull();
        third.Value.Description.ShouldBeNull();
        order.Expenses.Count.ShouldBe(3);
        order.ExpensesTotal.ShouldBe(6065.00m);
        order.Profit.ShouldBe(15262.50m);
        order.Balance.ShouldBe(balance);
        order.EditVersion.ShouldNotBe(editVersion);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void ExpensesNeverChangeTheBalanceOfAnOrderThatIsPaid()
    {
        var order = Ord0148Discounted();
        order.AddPayment(new NewOrderPayment(Today, 12000m, Cash, null, null, Admin), Today, Created).IsSuccess.ShouldBeTrue();

        order.AddExpense(new NewOrderExpense(Today, 5000m, Fabric, null, Admin), Today, Later).IsSuccess.ShouldBeTrue();

        order.Balance.ShouldBe(9327.50m);
        order.PaidTotal.ShouldBe(12000m);
        order.Profit.ShouldBe(16327.50m);
        AssertTotalsMatchOrderMath(order);
    }

    [Theory]
    [InlineData("0.01")]
    [InlineData("1000000.00")]
    public void AnAmountAtTheEdgeOfTheRangeIsAccepted(string amount)
    {
        var order = Ord0148();

        var result = order.AddExpense(new NewOrderExpense(Today, decimal.Parse(amount, System.Globalization.CultureInfo.InvariantCulture), Fabric, null, Admin), Today, Later);

        result.IsSuccess.ShouldBeTrue();
    }

    [Theory]
    [InlineData(30, true)]
    [InlineData(31, false)]
    [InlineData(0, true)]
    [InlineData(-1, true)]
    [InlineData(-400, true)]
    public void ADateUpToThirtyDaysAheadIsAcceptedAndAnyPastDayIsAccepted(int daysFromToday, bool accepted)
    {
        var order = Ord0148();

        var result = order.AddExpense(new NewOrderExpense(Today.AddDays(daysFromToday), 100m, Fabric, null, Admin), Today, Later);

        result.IsSuccess.ShouldBe(accepted);
        if (!accepted)
        {
            result.Error.FieldErrors.ShouldNotBeNull()["expenseDate"].ShouldBe(["Choose a date up to 30 days from today, Nov 27, 2026 at the latest."]);
        }
    }

    [Fact]
    public void ADescriptionOfTwoHundredCharactersIsAcceptedAndAnEmptyOneIsStoredAsNull()
    {
        var order = Ord0148();

        var long200 = order.AddExpense(new NewOrderExpense(Today, 100m, Fabric, new string('d', 200), Admin), Today, Later);
        var empty = order.AddExpense(new NewOrderExpense(Today, 100m, Fabric, string.Empty, Admin), Today, Later);

        long200.IsSuccess.ShouldBeTrue();
        empty.Value.Description.ShouldBeNull();
    }

    [Fact]
    public void EachBrokenExpenseFieldIsRefusedWithItsMessageAndNothingIsAdded()
    {
        foreach (var (path, message, expense) in BrokenExpenses)
        {
            var order = Ord0148();
            var editVersion = order.EditVersion;

            var result = order.AddExpense(expense, Today, Later);

            result.IsFailure.ShouldBeTrue(path);
            result.Error.Kind.ShouldBe(ErrorKind.Validation);
            var fields = result.Error.FieldErrors.ShouldNotBeNull();
            fields.Keys.ShouldBe([path]);
            fields[path].ShouldBe([message]);
            order.Expenses.ShouldBeEmpty();
            order.ExpensesTotal.ShouldBe(0m);
            order.EditVersion.ShouldBe(editVersion);
        }
    }

    [Fact]
    public void AHundredAndFirstExpenseIsRefusedWithATwentyTwoAndAHundredIsAccepted()
    {
        var order = Ord0148();
        for (var count = 0; count < 100; count++)
        {
            order.AddExpense(new NewOrderExpense(Today, 1m, Fabric, null, Admin), Today, Later).IsSuccess.ShouldBeTrue();
        }

        var result = order.AddExpense(new NewOrderExpense(Today, 1m, Fabric, null, Admin), Today, Later);

        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBe(OrderRules.TooManyExpenses);
        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        order.Expenses.Count.ShouldBe(100);
    }

    [Fact]
    public void ANullExpenseIsAProgrammingError()
    {
        Should.Throw<ArgumentNullException>(() => Ord0148().AddExpense(null!, Today, Later));
    }

    [Fact]
    public void UpdatingAnExpenseReturnsTheChangedPairsAndRecomputesTheProfit()
    {
        var order = Ord0148Discounted();
        var expense = order.AddExpense(new NewOrderExpense(Today.AddDays(-5), 3825.00m, Fabric, "Mesh", Manager), Today, Created).Value;
        var editVersion = order.EditVersion;

        var result = order.UpdateExpense(expense.Id, new NewOrderExpense(Today.AddDays(-4), 3000.00m, Ink, " Mesh and ink ", Admin), Today, Later);

        result.IsSuccess.ShouldBeTrue();
        var changes = result.Value;
        changes.Date.ShouldBe(new ValueChange<DateOnly>(Today.AddDays(-5), Today.AddDays(-4)));
        changes.Amount.ShouldBe(new ValueChange<decimal>(3825.00m, 3000.00m));
        changes.Category.ShouldBe(new ValueChange<Guid>(Fabric, Ink));
        changes.Payer.ShouldBe(new ValueChange<Guid>(Manager, Admin));
        changes.ChangedFields.ShouldBe(["description"]);
        changes.HasAny.ShouldBeTrue();
        changes.HasFieldChange.ShouldBeTrue();
        expense.Description.ShouldBe("Mesh and ink");
        expense.PaidByUserId.ShouldBe(Admin);
        order.ExpensesTotal.ShouldBe(3000.00m);
        order.Profit.ShouldBe(18327.50m);
        order.EditVersion.ShouldNotBe(editVersion);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void ChangingOnlyThePayerIsASeparateChangeAndNotAFieldChange()
    {
        var order = Ord0148Discounted();
        var expense = order.AddExpense(new NewOrderExpense(Today, 100m, Fabric, "Mesh", Manager), Today, Created).Value;

        var changes = order.UpdateExpense(expense.Id, new NewOrderExpense(Today, 100m, Fabric, "Mesh", Admin), Today, Later).Value;

        changes.Payer.ShouldBe(new ValueChange<Guid>(Manager, Admin));
        changes.HasFieldChange.ShouldBeFalse();
        changes.HasAny.ShouldBeTrue();
        changes.Date.ShouldBeNull();
        changes.Amount.ShouldBeNull();
        changes.Category.ShouldBeNull();
        changes.ChangedFields.ShouldBeEmpty();
    }

    [Fact]
    public void ChangingOnlyTheDescriptionIsAFieldChange()
    {
        var order = Ord0148Discounted();
        var expense = order.AddExpense(new NewOrderExpense(Today, 100m, Fabric, "Mesh", Manager), Today, Created).Value;

        var changes = order.UpdateExpense(expense.Id, new NewOrderExpense(Today, 100m, Fabric, null, Manager), Today, Later).Value;

        changes.ChangedFields.ShouldBe(["description"]);
        changes.HasFieldChange.ShouldBeTrue();
        changes.Payer.ShouldBeNull();
        expense.Description.ShouldBeNull();
    }

    [Fact]
    public void AnEditThatChangesNothingLeavesTheOrderAndItsEditVersionAlone()
    {
        var order = Ord0148Discounted();
        var expense = order.AddExpense(new NewOrderExpense(Today, 100m, Fabric, "Mesh", Manager), Today, Created).Value;
        var editVersion = order.EditVersion;

        var changes = order.UpdateExpense(expense.Id, new NewOrderExpense(Today, 100m, Fabric, "  Mesh ", Manager), Today, Later).Value;

        changes.HasAny.ShouldBeFalse();
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void AnEditWithABrokenFieldChangesNothing()
    {
        var order = Ord0148Discounted();
        var expense = order.AddExpense(new NewOrderExpense(Today, 100m, Fabric, "Mesh", Manager), Today, Created).Value;
        var editVersion = order.EditVersion;

        var result = order.UpdateExpense(expense.Id, new NewOrderExpense(Today, 0m, Ink, "Other", Admin), Today, Later);

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["amount"]);
        expense.Amount.ShouldBe(100m);
        expense.OrderExpenseCategoryId.ShouldBe(Fabric);
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void UpdatingOrRemovingAnExpenseThatIsNotOnTheOrderIsA404()
    {
        var order = Ord0148Discounted();

        var update = order.UpdateExpense(Guid.NewGuid(), new NewOrderExpense(Today, 100m, Fabric, null, Admin), Today, Later);
        var remove = order.RemoveExpense(Guid.NewGuid(), Later);

        update.Error.ShouldBe(OrderRules.ExpenseNotFound);
        remove.Error.ShouldBe(OrderRules.ExpenseNotFound);
        update.Error.Kind.ShouldBe(ErrorKind.NotFound);
    }

    [Fact]
    public void RemovingAnExpenseRecomputesTheExpensesAndTheProfit()
    {
        var order = Ord0148Discounted();
        var first = order.AddExpense(new NewOrderExpense(Today, 3825m, Fabric, null, Admin), Today, Created).Value;
        order.AddExpense(new NewOrderExpense(Today, 600m, Outsourcing, null, Admin), Today, Created).IsSuccess.ShouldBeTrue();
        var editVersion = order.EditVersion;

        var removed = order.RemoveExpense(first.Id, Later);

        removed.IsSuccess.ShouldBeTrue();
        removed.Value.ShouldBeSameAs(first);
        order.Expenses.Count.ShouldBe(1);
        order.ExpensesTotal.ShouldBe(600m);
        order.Profit.ShouldBe(20727.50m);
        order.EditVersion.ShouldNotBe(editVersion);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void ANewExpenseAfterARemovalGoesAfterTheHighestPosition()
    {
        var order = Ord0148();
        var first = order.AddExpense(new NewOrderExpense(Today, 1m, Fabric, null, Admin), Today, Created).Value;
        order.AddExpense(new NewOrderExpense(Today, 2m, Fabric, null, Admin), Today, Created).IsSuccess.ShouldBeTrue();
        order.RemoveExpense(first.Id, Later).IsSuccess.ShouldBeTrue();

        var added = order.AddExpense(new NewOrderExpense(Today, 3m, Fabric, null, Admin), Today, Later);

        added.Value.Position.ShouldBe(2);
    }

    [Fact]
    public void CreatingAnOrderWithExpensesGivesTheOrd0148Figures()
    {
        var result = Create(
            [new NewOrderDiscount(DiscountKind.Percentage, 5m, "League")],
            [new NewOrderPayment(Today.AddDays(-3), 10000m, Cash, null, null, Admin), new NewOrderPayment(Today.AddDays(-1), 2000m, Cash, null, null, Manager)],
            [
                new NewOrderExpense(Today.AddDays(-6), 3825m, Fabric, "Dri-fit mesh, 45 yds", Manager),
                new NewOrderExpense(Today.AddDays(-4), 1640m, Ink, "Ink and paper", Admin),
                new NewOrderExpense(Today.AddDays(-2), 600m, Outsourcing, null, Admin),
            ],
            Today);

        result.IsSuccess.ShouldBeTrue();
        var order = result.Value;
        order.Expenses.Select(static expense => expense.Position).ShouldBe([0, 1, 2]);
        order.Expenses.ShouldAllBe(expense => expense.Order == order && expense.OrderId == order.Id);
        order.Subtotal.ShouldBe(22450.00m);
        order.DiscountTotal.ShouldBe(1122.50m);
        order.Total.ShouldBe(21327.50m);
        order.PaidTotal.ShouldBe(12000.00m);
        order.Balance.ShouldBe(9327.50m);
        order.ExpensesTotal.ShouldBe(6065.00m);
        order.Profit.ShouldBe(15262.50m);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void ABrokenExpenseInTheCreateBodyIsReportedUnderItsPlaceInTheList()
    {
        var result = Create(
            [],
            [],
            [new NewOrderExpense(Today, 100m, Fabric, null, Admin), new NewOrderExpense(Today, 100m, Fabric, null, Guid.Empty)],
            Today);

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["expenses[1].paidByUserId"]);
    }

    [Fact]
    public void AHundredAndFirstExpenseInTheCreateBodyIsRefusedOnExpenses()
    {
        var many = Enumerable.Range(0, 101).Select(static _ => new NewOrderExpense(Today, 1m, Fabric, null, Admin)).ToList();

        var result = Create([], [], many, Today);

        result.Error.FieldErrors.ShouldNotBeNull()["expenses"].ShouldBe([OrderRules.ExpensesTooMany]);
    }

    [Fact]
    public void ExpensesWithoutTheBusinessTodayAreAProgrammingError()
    {
        Should.Throw<ArgumentException>(() => Create([], [], [new NewOrderExpense(Today, 100m, Fabric, null, Admin)], today: null));
    }

    [Fact]
    public void ANullExpenseListIsAProgrammingError()
    {
        var details = new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null);
        var input = new NewOrder(details, OrderStatus.Pending, [new NewOrderItem(JerseyType, "Jersey top", null, 1, 10m)]) { Expenses = null! };

        Should.Throw<ArgumentNullException>(() => Order.Create(input, Guid.NewGuid(), Created, Today));
    }

    [Fact]
    public void TheExpensePathNamesTheListPlaceOrJustTheField()
    {
        OrderRules.ExpensePath(2, "amount").ShouldBe("expenses[2].amount");
        OrderRules.ExpensePath(null, "amount").ShouldBe("amount");
        OrderRules.ExpenseDaysAhead.ShouldBe(30);
    }

    [Fact]
    public void ACheckOfANullExpenseIsAProgrammingError()
    {
        Should.Throw<ArgumentNullException>(() => OrderRules.CheckExpense(null, null!, Today));
    }

    private static Result<Order> Create(
        IReadOnlyList<NewOrderDiscount> discounts,
        IReadOnlyList<NewOrderPayment> payments,
        IReadOnlyList<NewOrderExpense> expenses,
        DateOnly? today)
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
        return Order.Create(new NewOrder(details, OrderStatus.Pending, items) { Discounts = discounts, Payments = payments, Expenses = expenses }, Guid.NewGuid(), Created, today);
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
            [.. order.Expenses.Select(static expense => expense.Amount)],
            cancelled: false);
        order.Subtotal.ShouldBe(figures.Subtotal);
        order.DiscountTotal.ShouldBe(figures.Discount);
        order.Total.ShouldBe(figures.Total);
        order.PaidTotal.ShouldBe(figures.Paid);
        order.Balance.ShouldBe(figures.Balance);
        order.CustomerCredit.ShouldBe(figures.CustomerCredit);
        order.ExpensesTotal.ShouldBe(figures.Expenses);
        order.Profit.ShouldBe(figures.Profit);
        order.FullyPaid.ShouldBe(figures.FullyPaid);
    }
}
