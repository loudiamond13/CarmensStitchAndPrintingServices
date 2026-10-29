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
