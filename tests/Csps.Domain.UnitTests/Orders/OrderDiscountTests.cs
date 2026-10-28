using Csps.Domain.Common;
using Csps.Domain.Expenses;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>D-15, ORD-05, D-31, Pitfall 3: discounts re-check every rule, recompute the totals through OrderMath, and the discounts never pass the items total.</summary>
public sealed class OrderDiscountTests
{
    private static readonly DateTimeOffset Created = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = new(2026, 10, 29, 3, 0, 0, TimeSpan.Zero);
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");

    private static readonly (string Path, string Message, NewOrderDiscount Discount)[] BrokenDiscounts =
    [
        ("kind", OrderRules.DiscountKindInvalid, new NewOrderDiscount((DiscountKind)0, 10m, "League")),
        ("kind", OrderRules.DiscountKindInvalid, new NewOrderDiscount((DiscountKind)3, 10m, "League")),
        ("value", OrderRules.FixedDiscountOutOfRange, new NewOrderDiscount(DiscountKind.Fixed, 0m, "League")),
        ("value", OrderRules.FixedDiscountOutOfRange, new NewOrderDiscount(DiscountKind.Fixed, -1m, "League")),
        ("value", OrderRules.FixedDiscountOutOfRange, new NewOrderDiscount(DiscountKind.Fixed, 1_000_000.01m, "League")),
        ("value", OrderRules.MoneyDecimals, new NewOrderDiscount(DiscountKind.Fixed, 10.005m, "League")),
        ("value", OrderRules.PercentDiscountOutOfRange, new NewOrderDiscount(DiscountKind.Percentage, 0m, "League")),
        ("value", OrderRules.PercentDiscountOutOfRange, new NewOrderDiscount(DiscountKind.Percentage, 100.01m, "League")),
        ("value", OrderRules.MoneyDecimals, new NewOrderDiscount(DiscountKind.Percentage, 7.555m, "League")),
        ("reason", OrderRules.DiscountReasonRequired, new NewOrderDiscount(DiscountKind.Fixed, 10m, "   ")),
        ("reason", OrderRules.DiscountReasonRequired, new NewOrderDiscount(DiscountKind.Fixed, 10m, string.Empty)),
        ("reason", OrderRules.DiscountReasonTooLong, new NewOrderDiscount(DiscountKind.Fixed, 10m, new string('a', 101))),
    ];

    [Fact]
    public void AddingAPercentageDiscountRecomputesTheTotalsThroughOrderMath()
    {
        var order = Ord0148();
        var editVersion = order.EditVersion;

        var result = order.AddDiscount(new NewOrderDiscount(DiscountKind.Percentage, 5m, "  Barangay league discount "), Later);

        result.IsSuccess.ShouldBeTrue();
        var added = result.Value;
        added.Reason.ShouldBe("Barangay league discount");
        added.Kind.ShouldBe(DiscountKind.Percentage);
        added.Value.ShouldBe(5m);
        added.Position.ShouldBe(0);
        added.OrderId.ShouldBe(order.Id);
        added.Order.ShouldBeSameAs(order);
        order.Discounts.ShouldHaveSingleItem().ShouldBeSameAs(added);
        order.Subtotal.ShouldBe(22450.00m);
        order.DiscountTotal.ShouldBe(1122.50m);
        order.Total.ShouldBe(21327.50m);
        order.Balance.ShouldBe(21327.50m);
        order.Profit.ShouldBe(21327.50m);
        order.EditVersion.ShouldNotBe(editVersion);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void ADiscountOfEachKindSumsAsOrderMathSumsThem()
    {
        var order = Ord0148();

        order.AddDiscount(new NewOrderDiscount(DiscountKind.Percentage, 5m, "League"), Later).IsSuccess.ShouldBeTrue();
        var second = order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 500.00m, "Loyal customer"), Later);

        second.Value.Position.ShouldBe(1);
        order.DiscountTotal.ShouldBe(1622.50m);
        order.Total.ShouldBe(20827.50m);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void EachBrokenDiscountFieldIsRefusedWithItsMessageAndNothingIsAdded()
    {
        foreach (var (path, message, broken) in BrokenDiscounts)
        {
            var order = Ord0148();
            var editVersion = order.EditVersion;

            var result = order.AddDiscount(broken, Later);

            result.IsFailure.ShouldBeTrue(message);
            result.Error.Kind.ShouldBe(ErrorKind.Validation, message);
            var fields = result.Error.FieldErrors.ShouldNotBeNull();
            fields.Keys.ShouldBe([path], message);
            fields[path].ShouldBe([message]);
            order.Discounts.ShouldBeEmpty(message);
            order.EditVersion.ShouldBe(editVersion, message);
        }
    }

    [Theory]
    [InlineData(DiscountKind.Fixed, 0.01)]
    [InlineData(DiscountKind.Fixed, 1_000_000.00)]
    [InlineData(DiscountKind.Percentage, 0.01)]
    [InlineData(DiscountKind.Percentage, 100.00)]
    public void TheEdgeValuesOfEachKindAreAccepted(DiscountKind kind, double value)
    {
        var order = OrderOf(new NewOrderItem(JerseyType, "Jersey top", null, 10_000, 100.00m));

        var result = order.AddDiscount(new NewOrderDiscount(kind, (decimal)value, "Edge"), Later);

        result.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public void AReasonOfOneHundredCharactersIsAccepted()
    {
        var order = Ord0148();

        order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 10m, new string('a', 100)), Later).IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public void ATwentyFirstDiscountIsRefusedAndTheTwentiethIsAccepted()
    {
        var order = Ord0148();
        for (var index = 0; index < 19; index++)
        {
            order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 0.01m, "Small"), Later).IsSuccess.ShouldBeTrue();
        }

        var twentieth = order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 0.01m, "Small"), Later);
        var editVersion = order.EditVersion;
        var twentyFirst = order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 0.01m, "Small"), Later.AddHours(1));

        twentieth.IsSuccess.ShouldBeTrue();
        twentyFirst.IsFailure.ShouldBeTrue();
        twentyFirst.Error.ShouldBe(OrderRules.TooManyDiscounts);
        twentyFirst.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        twentyFirst.Error.Code.ShouldBe("orders.too-many-discounts");
        twentyFirst.Error.Message.ShouldBe("An order can have at most 20 discounts.");
        order.Discounts.Count.ShouldBe(20);
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void ADiscountAboveTheItemsTotalIsRefusedOnValueAndTheTotalStaysAboveZero()
    {
        var order = Ord0148();
        var editVersion = order.EditVersion;

        var result = order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 30_000.00m, "Too big"), Later);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        var fields = result.Error.FieldErrors.ShouldNotBeNull();
        fields.Keys.ShouldBe(["value"]);
        fields["value"].ShouldBe(["The discounts would be more than the items total. Lower or remove a discount first."]);
        order.Discounts.ShouldBeEmpty();
        order.Total.ShouldBe(22450.00m);
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void TwoPercentagesThatPassOneHundredTogetherAreRefusedAndTheWholeItemsTotalIsAccepted()
    {
        var order = Ord0148();
        order.AddDiscount(new NewOrderDiscount(DiscountKind.Percentage, 60m, "First"), Later).IsSuccess.ShouldBeTrue();

        var tooMuch = order.AddDiscount(new NewOrderDiscount(DiscountKind.Percentage, 40.01m, "Second"), Later);
        var exact = order.AddDiscount(new NewOrderDiscount(DiscountKind.Percentage, 40m, "Second"), Later);

        tooMuch.IsFailure.ShouldBeTrue();
        exact.IsSuccess.ShouldBeTrue();
        order.Total.ShouldBe(0.00m);
        order.Discounts.Count.ShouldBe(2);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void UpdatingADiscountRecomputesTheTotalsAndGivesTheChanges()
    {
        var order = Ord0148();
        var discount = order.AddDiscount(new NewOrderDiscount(DiscountKind.Percentage, 5m, "League"), Created).Value;
        var editVersion = order.EditVersion;

        var result = order.UpdateDiscount(discount.Id, new NewOrderDiscount(DiscountKind.Percentage, 10m, "League"), Later);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Value.ShouldBe(new ValueChange<decimal>(5m, 10m));
        result.Value.Kind.ShouldBeNull();
        result.Value.ReasonChanged.ShouldBeFalse();
        result.Value.HasAny.ShouldBeTrue();
        discount.Value.ShouldBe(10m);
        order.DiscountTotal.ShouldBe(2245.00m);
        order.Total.ShouldBe(20205.00m);
        order.EditVersion.ShouldNotBe(editVersion);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void ChangingTheKindAndTheReasonIsReportedAndTheReasonIsTrimmed()
    {
        var order = Ord0148();
        var discount = order.AddDiscount(new NewOrderDiscount(DiscountKind.Percentage, 5m, "League"), Created).Value;

        var result = order.UpdateDiscount(discount.Id, new NewOrderDiscount(DiscountKind.Fixed, 500m, "  Loyal customer "), Later);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Kind.ShouldBe(new ValueChange<DiscountKind>(DiscountKind.Percentage, DiscountKind.Fixed));
        result.Value.Value.ShouldBe(new ValueChange<decimal>(5m, 500m));
        result.Value.ReasonChanged.ShouldBeTrue();
        discount.Reason.ShouldBe("Loyal customer");
        order.DiscountTotal.ShouldBe(500.00m);
    }

    [Fact]
    public void ChangingOnlyTheReasonKeepsTheMoneyAndMovesTheVersion()
    {
        var order = Ord0148();
        var discount = order.AddDiscount(new NewOrderDiscount(DiscountKind.Percentage, 5m, "League"), Created).Value;
        var editVersion = order.EditVersion;

        var result = order.UpdateDiscount(discount.Id, new NewOrderDiscount(DiscountKind.Percentage, 5m, "Club"), Later);

        result.Value.Kind.ShouldBeNull();
        result.Value.Value.ShouldBeNull();
        result.Value.ReasonChanged.ShouldBeTrue();
        order.DiscountTotal.ShouldBe(1122.50m);
        order.EditVersion.ShouldNotBe(editVersion);
    }

    [Fact]
    public void AnEditThatChangesNothingKeepsTheOrderAndItsVersionUntouched()
    {
        var order = Ord0148();
        var discount = order.AddDiscount(new NewOrderDiscount(DiscountKind.Percentage, 5m, "League"), Created).Value;
        var editVersion = order.EditVersion;

        var result = order.UpdateDiscount(discount.Id, new NewOrderDiscount(DiscountKind.Percentage, 5.00m, " League "), Later);

        result.IsSuccess.ShouldBeTrue();
        result.Value.HasAny.ShouldBeFalse();
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void AnEditWithABrokenFieldIsRefusedOnThePlainFieldNameAndNothingChanges()
    {
        var order = Ord0148();
        var discount = order.AddDiscount(new NewOrderDiscount(DiscountKind.Percentage, 5m, "League"), Created).Value;
        var editVersion = order.EditVersion;

        var result = order.UpdateDiscount(discount.Id, new NewOrderDiscount(DiscountKind.Percentage, 101m, "League"), Later);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["value"]);
        discount.Value.ShouldBe(5m);
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void AnEditThatWouldPassTheItemsTotalIsRefusedOnValueAndNothingChanges()
    {
        var order = Ord0148();
        order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 20_000m, "First"), Created).IsSuccess.ShouldBeTrue();
        var second = order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 1_000m, "Second"), Created).Value;
        var editVersion = order.EditVersion;

        var tooMuch = order.UpdateDiscount(second.Id, new NewOrderDiscount(DiscountKind.Fixed, 2_450.01m, "Second"), Later);
        var exact = order.UpdateDiscount(second.Id, new NewOrderDiscount(DiscountKind.Fixed, 2_450.00m, "Second"), Later);

        tooMuch.IsFailure.ShouldBeTrue();
        tooMuch.Error.FieldErrors.ShouldNotBeNull()["value"].ShouldBe([OrderRules.DiscountAboveSubtotalMessage]);
        exact.IsSuccess.ShouldBeTrue();
        order.Total.ShouldBe(0.00m);
        order.EditVersion.ShouldNotBe(editVersion);
    }

    [Fact]
    public void RemovingADiscountRecomputesTheTotalsAndGivesTheRemovedDiscountBack()
    {
        var order = Ord0148();
        var discount = order.AddDiscount(new NewOrderDiscount(DiscountKind.Percentage, 5m, "League"), Created).Value;
        var editVersion = order.EditVersion;

        var result = order.RemoveDiscount(discount.Id, Later);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBeSameAs(discount);
        order.Discounts.ShouldBeEmpty();
        order.DiscountTotal.ShouldBe(0.00m);
        order.Total.ShouldBe(22450.00m);
        order.EditVersion.ShouldNotBe(editVersion);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void AnUnknownDiscountIdIsNotFoundOnUpdateAndRemoveAndNothingChanges()
    {
        var order = Ord0148();
        order.AddDiscount(new NewOrderDiscount(DiscountKind.Percentage, 5m, "League"), Created).IsSuccess.ShouldBeTrue();
        var editVersion = order.EditVersion;

        var update = order.UpdateDiscount(Guid.NewGuid(), new NewOrderDiscount(DiscountKind.Percentage, 6m, "League"), Later);
        var remove = order.RemoveDiscount(Guid.NewGuid(), Later);

        update.Error.ShouldBe(OrderRules.DiscountNotFound);
        remove.Error.ShouldBe(OrderRules.DiscountNotFound);
        update.Error.Kind.ShouldBe(ErrorKind.NotFound);
        update.Error.Code.ShouldBe("orders.discount-not-found");
        update.Error.Message.ShouldBe("This discount was not found on this order.");
        order.Discounts.Count.ShouldBe(1);
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void AQuantityCutThatLeavesTheDiscountsAboveTheNewSubtotalIsRefusedAndNothingChanges()
    {
        var order = OrderOf(Jersey(15, 650.00m));
        order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 9_000m, "Big deal"), Created).IsSuccess.ShouldBeTrue();
        var editVersion = order.EditVersion;
        var item = order.Items[0];

        var result = order.UpdateItem(item.Id, Jersey(10, 650.00m), Later);

        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBe(OrderRules.DiscountAboveSubtotal);
        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Code.ShouldBe("orders.discount-above-subtotal");
        result.Error.Message.ShouldBe("The discounts would be more than the items total. Lower or remove a discount first.");
        item.Quantity.ShouldBe(15);
        item.LineTotal.ShouldBe(9750.00m);
        order.Subtotal.ShouldBe(9750.00m);
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void AQuantityCutThatKeepsTheDiscountsAtOrBelowTheNewSubtotalIsAccepted()
    {
        var order = OrderOf(Jersey(15, 650.00m));
        order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 9_000m, "Big deal"), Created).IsSuccess.ShouldBeTrue();

        var result = order.UpdateItem(order.Items[0].Id, Jersey(14, 650.00m), Later);

        result.IsSuccess.ShouldBeTrue();
        order.Subtotal.ShouldBe(9100.00m);
        order.Total.ShouldBe(100.00m);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void ARemovalThatLeavesTheDiscountsAboveTheNewSubtotalIsRefusedAndNothingChanges()
    {
        var order = OrderOf(Jersey(15, 650.00m), new NewOrderItem(JerseyType, "Coach polo", "L", 2, 550.00m));
        order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 10_000m, "Big deal"), Created).IsSuccess.ShouldBeTrue();
        var editVersion = order.EditVersion;
        var polo = order.Items[1];

        var result = order.RemoveItem(polo.Id, Later);

        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBe(OrderRules.DiscountAboveSubtotal);
        order.Items.Count.ShouldBe(2);
        order.Subtotal.ShouldBe(10850.00m);
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void ARemovalThatKeepsTheDiscountsBelowTheNewSubtotalIsAccepted()
    {
        var order = OrderOf(Jersey(15, 650.00m), new NewOrderItem(JerseyType, "Coach polo", "L", 2, 550.00m));
        order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 9_000m, "Big deal"), Created).IsSuccess.ShouldBeTrue();

        var result = order.RemoveItem(order.Items[1].Id, Later);

        result.IsSuccess.ShouldBeTrue();
        order.Total.ShouldBe(750.00m);
    }

    [Fact]
    public void AnItemEditThatKeepsTheSubtotalKeepsTheDiscountsValid()
    {
        var order = OrderOf(Jersey(15, 650.00m));
        order.AddDiscount(new NewOrderDiscount(DiscountKind.Fixed, 9_750m, "Whole total"), Created).IsSuccess.ShouldBeTrue();

        var result = order.UpdateItem(order.Items[0].Id, Jersey(15, 650.00m) with { Description = "Jersey top v2" }, Later);

        result.IsSuccess.ShouldBeTrue();
        order.Total.ShouldBe(0.00m);
    }

    private static NewOrderItem Jersey(int quantity, decimal unitPrice) => new(JerseyType, "Jersey top", "S-XL", quantity, unitPrice);

    private static Order Ord0148() => OrderOf(
        Jersey(15, 650.00m),
        new NewOrderItem(JerseyType, "Jersey shorts", "S-XL", 15, 300.00m),
        new NewOrderItem(JerseyType, "Coach polo", "L", 2, 550.00m),
        new NewOrderItem(JerseyType, "Warm-up long sleeves", "M-XL", 15, 420.00m),
        new NewOrderItem(JerseyType, "Team banner", null, 1, 800.00m));

    private static Order OrderOf(params NewOrderItem[] items)
    {
        var details = new OrderDetails(
            "Juan Dela Cruz",
            "Brgy. San Roque Ballers",
            "0917 123 4567",
            "juan.dc@example.com",
            null,
            new DateOnly(2026, 10, 28),
            new DateOnly(2026, 11, 11),
            null);
        return Order.Create(new NewOrder(details, OrderStatus.Pending, items), Guid.NewGuid(), Created).Value;
    }

    private static void AssertTotalsMatchOrderMath(Order order)
    {
        var figures = OrderMath.Compute(
            [.. order.Items.Select(static item => new OrderMathItem(item.Quantity, item.UnitPrice))],
            [.. order.Discounts.Select(static discount => new OrderMathDiscount(discount.Kind, discount.Value))],
            [],
            [],
            [],
            cancelled: false);
        order.Subtotal.ShouldBe(figures.Subtotal);
        order.DiscountTotal.ShouldBe(figures.Discount);
        order.Total.ShouldBe(figures.Total);
        order.Balance.ShouldBe(figures.Balance);
        order.Profit.ShouldBe(figures.Profit);
        order.Total.ShouldBeGreaterThanOrEqualTo(0m);
    }
}
