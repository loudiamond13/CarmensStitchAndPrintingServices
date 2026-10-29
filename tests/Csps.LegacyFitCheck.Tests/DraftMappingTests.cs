using Csps.Domain.Expenses;
using Csps.Domain.Identity;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.LegacyFitCheck.Findings;
using Csps.LegacyFitCheck.Mapping;
using Csps.LegacyFitCheck.Source;

namespace Csps.LegacyFitCheck.Tests;

public sealed class DraftMappingTests
{
    private static readonly DateTime ManilaNextDay = new(2025, 12, 31, 16, 30, 0, DateTimeKind.Unspecified);
    private static readonly DateTime SameDay = new(2025, 3, 4, 2, 30, 0, DateTimeKind.Unspecified);

    [Fact]
    public void AStoredTimeLateInTheDayReadsAsTheNextManilaDay()
    {
        LegacyDates.ToManilaDate(ManilaNextDay).ShouldBe(new DateOnly(2026, 1, 1));
        LegacyDates.AsStoredDate(ManilaNextDay).ShouldBe(new DateOnly(2025, 12, 31));
        LegacyDates.Differs(ManilaNextDay).ShouldBeTrue();
    }

    [Fact]
    public void AStoredTimeEarlyInTheDayReadsTheSameBothWays()
    {
        LegacyDates.ToManilaDate(SameDay).ShouldBe(new DateOnly(2025, 3, 4));
        LegacyDates.AsStoredDate(SameDay).ShouldBe(new DateOnly(2025, 3, 4));
        LegacyDates.Differs(SameDay).ShouldBeFalse();
    }

    [Fact]
    public void TheNumberIsBuiltFromTheManilaYearAndTheLegacyIdAndReportedAsCannotMap()
    {
        var mapped = Map(Order(42, orderDate: new DateTime(2025, 12, 31, 20, 0, 0, DateTimeKind.Unspecified)));

        mapped.Snapshot.ShouldNotBeNull().Number.ShouldBe("ORD-2026-0042");
        Single(mapped, FindingType.CannotMap, "order.no-number").LegacyKey.ShouldBe("Orders:42");
    }

    [Theory]
    [InlineData("Open", OrderStatus.Pending)]
    [InlineData(" in progress ", OrderStatus.InProduction)]
    [InlineData("COMPLETED", OrderStatus.Completed)]
    public void StatusNamesMapIgnoringCaseAndSpaces(string legacyName, OrderStatus expected)
    {
        var mapped = Map(Order(1), statusName: legacyName);

        mapped.Snapshot.ShouldNotBeNull().Status.ShouldBe(expected);
        mapped.Findings.ShouldNotContain(static finding => finding.RuleKey == "order.status-unknown");
    }

    [Fact]
    public void AnUnknownStatusIsCannotMapAndNotImported()
    {
        var mapped = Map(Order(1), statusName: "On Hold");

        mapped.Snapshot.ShouldBeNull();
        Single(mapped, FindingType.CannotMap, "order.status-unknown");
    }

    [Fact]
    public void AnOrderWithNoDateIsCannotMapAndNotImported()
    {
        var mapped = Map(Order(1, noDate: true));

        mapped.Snapshot.ShouldBeNull();
        Single(mapped, FindingType.CannotMap, "order.no-date");
    }

    [Fact]
    public void ADeletedOrderIsCannotMapAndNotImported()
    {
        var mapped = Map(Order(1, isDeleted: true));

        mapped.Snapshot.ShouldBeNull();
        Single(mapped, FindingType.CannotMap, "order.deleted");
    }

    [Fact]
    public void TheCustomerNameAndNotesAreTrimmedAndTheOtherDetailsAreEmpty()
    {
        var mapped = Map(Order(1, name: "  Sample Club  ", note: "  Sample note "));

        var details = mapped.Snapshot.ShouldNotBeNull().Details;
        details.CustomerName.ShouldBe("Sample Club");
        details.Notes.ShouldBe("Sample note");
        details.TeamName.ShouldBeNull();
        details.ContactNumber.ShouldBeNull();
        details.Email.ShouldBeNull();
        details.Address.ShouldBeNull();
        details.DueDate.ShouldBeNull();
    }

    [Fact]
    public void ABlankNameIsPassedThroughForTheRulesToJudge()
    {
        var mapped = Map(Order(1, name: "   "));

        mapped.Snapshot.ShouldNotBeNull().Details.CustomerName.ShouldBeEmpty();
        mapped.Findings.Where(static finding => finding.Type == FindingType.CannotMap).Select(static finding => finding.RuleKey)
            .ShouldBe(["order.no-number", "order.no-status-history"], ignoreOrder: true);
    }

    [Fact]
    public void EveryMappedOrderReportsThatItHasNoStatusHistory()
    {
        var mapped = Map(Order(1));

        Single(mapped, FindingType.CannotMap, "order.no-status-history").LegacyKey.ShouldBe("Orders:1");
        mapped.Snapshot.ShouldNotBeNull().StatusHistory.ShouldBeEmpty();
    }

    [Fact]
    public void ARecordWhoseTwoDateReadingsDifferGetsAnInfoFinding()
    {
        var parts = new LegacyOrderParts(
            [],
            [],
            [new LegacyPaymentRow { PaymentId = 7, OrderId = 1, PaymentDate = ManilaNextDay, Amount = 10m }],
            [new LegacyExpenseRow { ExpenseId = 8, OrderId = 1, SpentDate = ManilaNextDay, Amount = 5m }]);

        var mapped = Map(Order(1, orderDate: ManilaNextDay), parts);

        mapped.Findings.Where(static finding => finding.RuleKey == "dates.reading-differs").Select(static finding => (finding.LegacyKey, finding.Type))
            .ShouldBe([("Orders:1", FindingType.Info), ("Payments:7", FindingType.Info), ("Expenses:8", FindingType.Info)], ignoreOrder: true);
    }

    [Fact]
    public void ARecordWhoseDateReadingsAgreeGetsNoDateFinding()
    {
        var mapped = Map(Order(1, orderDate: SameDay));

        mapped.Findings.ShouldNotContain(static finding => finding.RuleKey == "dates.reading-differs");
    }

    [Fact]
    public void ThePaymentAndExpenseDatesUseTheManilaReading()
    {
        var parts = new LegacyOrderParts(
            [],
            [],
            [new LegacyPaymentRow { PaymentId = 7, OrderId = 1, PaymentDate = ManilaNextDay, Amount = 10m }],
            [new LegacyExpenseRow { ExpenseId = 8, OrderId = 1, SpentDate = ManilaNextDay, Amount = 5m }]);

        var snapshot = Map(Order(1, orderDate: SameDay), parts).Snapshot.ShouldNotBeNull();

        snapshot.Payments.ShouldHaveSingleItem().PaymentDate.ShouldBe(new DateOnly(2026, 1, 1));
        snapshot.Expenses.ShouldHaveSingleItem().ExpenseDate.ShouldBe(new DateOnly(2026, 1, 1));
        snapshot.Payments[0].ReceivedByUserId.ShouldBe(LegacyHolder.Id);
    }

    [Fact]
    public void AnItemKeepsItsValuesAndADoneFlagIsCannotMap()
    {
        var parts = new LegacyOrderParts(
            [
                new LegacyOrderItemRow { OrderItemId = 5, OrderId = 1, Description = "  Sample polo ", Quantity = 3, Price = 12.3456m, IsDone = true },
                new LegacyOrderItemRow { OrderItemId = 6, OrderId = 1, Description = "Sample cap", Quantity = 1, Price = 2m, IsDone = false },
            ],
            [],
            [],
            []);

        var mapped = Map(Order(1), parts);

        var items = mapped.Snapshot.ShouldNotBeNull().Items;
        items[0].Description.ShouldBe("Sample polo");
        items[0].Quantity.ShouldBe(3);
        items[0].UnitPrice.ShouldBe(12.3456m);
        items[0].SizeVariant.ShouldBeNull();
        Single(mapped, FindingType.CannotMap, "item.done-flag").LegacyKey.ShouldBe("OrderItems:5");
    }

    [Fact]
    public void ADiscountIsFixedAndAGiverNameIsCannotMap()
    {
        var parts = new LegacyOrderParts(
            [],
            [
                new LegacyDiscountRow { OrderDiscountId = 3, OrderId = 1, Description = "  Sample promo ", Amount = 20.125m, DiscountedBy = "Sample staff" },
                new LegacyDiscountRow { OrderDiscountId = 4, OrderId = 1, Description = "Other promo", Amount = 5m, DiscountedBy = "  " },
            ],
            [],
            []);

        var mapped = Map(Order(1), parts);

        var discounts = mapped.Snapshot.ShouldNotBeNull().Discounts;
        discounts[0].ShouldBe(new NewOrderDiscount(DiscountKind.Fixed, 20.125m, "Sample promo"));
        discounts[1].Value.ShouldBe(5m);
        Single(mapped, FindingType.CannotMap, "discount.giver").LegacyKey.ShouldBe("Discounts:3");
    }

    [Fact]
    public void APaymentKeepsThePayerTextInTheNotes()
    {
        var parts = new LegacyOrderParts(
            [],
            [],
            [
                new LegacyPaymentRow { PaymentId = 7, OrderId = 1, PaymentDate = SameDay, PaidBy = " Sample payer ", Amount = 10.5m, PaidTo = "Sample receiver" },
                new LegacyPaymentRow { PaymentId = 8, OrderId = 1, PaymentDate = SameDay, PaidBy = null, Amount = 4m, PaidTo = "Sample receiver" },
            ],
            []);

        var mapped = Map(Order(1), parts);

        var payments = mapped.Snapshot.ShouldNotBeNull().Payments;
        payments[0].Notes.ShouldBe("Sample payer");
        payments[0].Amount.ShouldBe(10.5m);
        payments[0].Reference.ShouldBeNull();
        payments[0].PaymentMethodId.ShouldBe(ListMatches.UnknownPaymentMethodId);
        payments[1].Notes.ShouldBeNull();
        Single(mapped, FindingType.Info, "payment.payer-text-in-notes").LegacyKey.ShouldBe("Payments:7");
    }

    [Fact]
    public void ADeletedPaymentIsLeftOutAndEachIsReported()
    {
        var parts = new LegacyOrderParts(
            [],
            [],
            [
                new LegacyPaymentRow { PaymentId = 7, OrderId = 1, PaymentDate = SameDay, Amount = 10m, IsDeleted = true },
                new LegacyPaymentRow { PaymentId = 8, OrderId = 1, PaymentDate = SameDay, Amount = 4m, IsDeleted = false },
            ],
            []);

        var mapped = Map(Order(1), parts);

        mapped.Snapshot.ShouldNotBeNull().Payments.ShouldHaveSingleItem().Amount.ShouldBe(4m);
        Single(mapped, FindingType.CannotMap, "payment.deleted-dropped").LegacyKey.ShouldBe("Payments:7");
        Single(mapped, FindingType.CannotMap, "payment.no-method").LegacyKey.ShouldBe("Payments:8");
    }

    [Fact]
    public void AnOrderExpenseUsesOthersAndOneWithNoDateIsLeftOut()
    {
        var parts = new LegacyOrderParts(
            [],
            [],
            [],
            [
                new LegacyExpenseRow { ExpenseId = 1, OrderId = 1, Description = " Sample thread ", SpentDate = SameDay, Amount = 30.5m, IsCompanyExpenses = false },
                new LegacyExpenseRow { ExpenseId = 2, OrderId = 1, Description = "No date", SpentDate = null, Amount = 5m, IsCompanyExpenses = false },
                new LegacyExpenseRow { ExpenseId = 3, OrderId = null, Description = "Sample rent", SpentDate = SameDay, Amount = 900m, IsCompanyExpenses = true },
            ]);

        var mapped = Map(Order(1), parts);

        var expense = mapped.Snapshot.ShouldNotBeNull().Expenses.ShouldHaveSingleItem();
        expense.Description.ShouldBe("Sample thread");
        expense.Amount.ShouldBe(30.5m);
        expense.OrderExpenseCategoryId.ShouldBe(OrderListSeed.OrderExpenseOthersId);
        expense.PaidByUserId.ShouldBe(LegacyHolder.Id);
        Single(mapped, FindingType.CannotMap, "order-expense.no-date").LegacyKey.ShouldBe("Expenses:2");
        Single(mapped, FindingType.CannotMap, "order-expense.no-category").LegacyKey.ShouldBe("Expenses:1");
    }

    [Fact]
    public void ACompanyExpenseBecomesAnAddExpenseRequestWithOthersAndTheManilaDate()
    {
        var mapped = DraftMapping.MapCompanyExpense(new LegacyExpenseRow { ExpenseId = 5, Description = "  Sample rent  ", SpentDate = ManilaNextDay, IsCompanyExpenses = true, Amount = 12.3456m, PaidBy = "Sample payer" });

        mapped.LegacyKey.ShouldBe("Expenses:5");
        mapped.Request.Date.ShouldBe("2026-01-01");
        mapped.Request.CategoryId.ShouldBe(ExpenseCategorySeed.OthersId);
        mapped.Request.Description.ShouldBe("Sample rent");
        mapped.Request.Amount.ShouldBe(12.3456m);
        mapped.Request.PaidByUserId.ShouldBe(LegacyHolder.Id);
        mapped.Request.Notes.ShouldBeNull();
        mapped.Findings.ShouldContain(static finding => finding.Type == FindingType.CannotMap && finding.RuleKey == "company-expense.no-category" && finding.Kind == RecordKind.CompanyExpense);
        mapped.Findings.ShouldContain(static finding => finding.Type == FindingType.LegacyHolderUsed && finding.Kind == RecordKind.CompanyExpense);
        mapped.Findings.ShouldContain(static finding => finding.Type == FindingType.Info && finding.RuleKey == "dates.reading-differs");
    }

    [Fact]
    public void ACompanyExpenseWithNoDateKeepsTheDateEmptyForTheValidator()
    {
        var mapped = DraftMapping.MapCompanyExpense(new LegacyExpenseRow { ExpenseId = 6, Description = "Sample", SpentDate = null, IsCompanyExpenses = true, Amount = 5m, PaidBy = string.Empty });

        mapped.Request.Date.ShouldBeNull();
        mapped.Findings.ShouldNotContain(static finding => finding.RuleKey == "dates.reading-differs");
    }

    private static MappedOrder Map(LegacyOrderRow order, LegacyOrderParts? parts = null, string statusName = "Open")
    {
        var types = new Dictionary<int, string?> { [1] = "Polo Shirt" };
        var statuses = new Dictionary<int, string?> { [1] = statusName };
        return DraftMapping.MapOrder(order, parts ?? LegacyOrderParts.None, types, statuses, ListMatching.ForProductTypes(types.Values));
    }

    private static LegacyOrderRow Order(int id, DateTime? orderDate = null, bool noDate = false, bool isDeleted = false, string? name = "Sample Club", string? note = null) =>
        new()
        {
            OrderId = id,
            OrderName = name,
            OrderDate = noDate ? null : orderDate ?? SameDay,
            Note = note,
            IsDeleted = isDeleted,
            OrderTypeId = 1,
            StatusId = 1,
        };

    private static Finding Single(MappedOrder mapped, FindingType type, string rule) =>
        mapped.Findings.Where(finding => finding.Type == type && finding.RuleKey == rule).ShouldHaveSingleItem();
}
