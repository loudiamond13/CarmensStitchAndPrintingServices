using Csps.Domain.Identity;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.LegacyFitCheck.Checks;
using Csps.LegacyFitCheck.Findings;
using Csps.LegacyFitCheck.Mapping;

namespace Csps.LegacyFitCheck.Tests;

public sealed class TotalsComparerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 29, 0, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 29);
    private static readonly DateOnly OrderDate = new(2025, 6, 10);

    private static readonly OrderTotals Csps = new(100m, 10m, 90m, 40m, 0m, 50m, 0m, 5m, 85m, FullyPaid: false);

    private static readonly LegacyStoredTotals Same = new(90m, 10m, 40m, 50m, 5m);

    [Fact]
    public void EqualFiguresGiveNoFindingEvenWithMoreDecimals()
    {
        var legacy = new LegacyStoredTotals(90.0000m, 10.0000m, 40.0000m, 50.0000m, 5.0000m);

        TotalsComparer.Compare("Orders:1", Csps, legacy).ShouldBeEmpty();
    }

    [Theory]
    [InlineData("totals.total")]
    [InlineData("totals.discount")]
    [InlineData("totals.paid")]
    [InlineData("totals.balance")]
    [InlineData("totals.expenses")]
    public void AFigureOffByOneCentavoIsOneMismatchNamingTheFigure(string ruleKey)
    {
        var legacy = ruleKey switch
        {
            "totals.total" => Same with { TotalAmount = 90.01m },
            "totals.discount" => Same with { TotalDiscount = 10.01m },
            "totals.paid" => Same with { PaidAmount = 40.01m },
            "totals.balance" => Same with { TotalBalance = 50.01m },
            _ => Same with { TotalExpenses = 5.01m },
        };

        var found = TotalsComparer.Compare("Orders:1", Csps, legacy).ShouldHaveSingleItem();

        found.Type.ShouldBe(FindingType.TotalMismatch);
        found.RuleKey.ShouldBe(ruleKey);
        found.LegacyKey.ShouldBe("Orders:1");
        found.Detail.ShouldNotBeNull().ShouldContain(".01");
        found.Message.ShouldNotBeNull().Any(char.IsDigit).ShouldBeFalse();
    }

    [Fact]
    public void TheDetailHoldsBothAmounts()
    {
        var found = TotalsComparer.Compare("Orders:1", Csps, Same with { TotalAmount = 90.01m }).ShouldHaveSingleItem();

        found.Detail.ShouldNotBeNull().ShouldContain("90.01");
        found.Detail.ShouldContain("90.00");
    }

    [Fact]
    public void ANullStoredTotalIsCannotMapAndTheOtherFiguresAreStillCompared()
    {
        var found = TotalsComparer.Compare("Orders:1", Csps, Same with { TotalAmount = null, TotalBalance = 49m });

        found.Select(static finding => (finding.Type, finding.RuleKey)).ShouldBe(
            [(FindingType.CannotMap, "totals.no-stored-total"), (FindingType.TotalMismatch, "totals.balance")],
            ignoreOrder: true);
    }

    [Fact]
    public void AFailedDefaultImportIsNotJudged()
    {
        var broken = Valid() with { Payments = [Payment(0m)] };

        var found = TotalsComparer.Check("Orders:1", broken, Same, Now, Today).ShouldHaveSingleItem();

        found.Type.ShouldBe(FindingType.NotJudged);
        found.RuleKey.ShouldBe("totals.not-compared");
    }

    [Fact]
    public void AnImportedOrderIsComparedWithItsWorkedOutFigures()
    {
        var snapshot = Valid() with { Payments = [Payment(40m)], Discounts = [new NewOrderDiscount(DiscountKind.Fixed, 10m, "Sample")] };
        var legacy = new LegacyStoredTotals(190m, 10m, 40m, 150m, 0m);

        TotalsComparer.Check("Orders:1", snapshot, legacy, Now, Today).ShouldBeEmpty();
        TotalsComparer.Check("Orders:1", snapshot, legacy with { PaidAmount = 41m }, Now, Today).ShouldHaveSingleItem().RuleKey.ShouldBe("totals.paid");
    }

    private static OrderImportSnapshot Valid() =>
        new(
            "ORD-2025-0001",
            new OrderDetails("Sample club", null, null, null, null, OrderDate, null, null),
            OrderStatus.Pending,
            [new NewOrderItem(OrderListSeed.ProductTypes[0].Id, "Sample shirt", null, 2, 100m)]);

    private static NewOrderPayment Payment(decimal amount) =>
        new(OrderDate, amount, OrderListSeed.PaymentMethods[0].Id, null, null, LegacyHolder.Id);
}
