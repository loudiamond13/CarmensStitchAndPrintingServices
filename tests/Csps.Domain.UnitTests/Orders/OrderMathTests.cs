using System.Globalization;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

public sealed class OrderMathTests
{
    private static readonly OrderMathItem[] NoItems = [];
    private static readonly OrderMathDiscount[] NoDiscounts = [];
    private static readonly decimal[] NoAmounts = [];

    [Fact]
    public void NullItemsThrowsNamingTheParameter()
    {
        Should.Throw<ArgumentNullException>(() => OrderMath.Compute(null!, NoDiscounts, NoAmounts, NoAmounts))
            .ParamName.ShouldBe("items");
    }

    [Fact]
    public void NullDiscountsThrowsNamingTheParameter()
    {
        Should.Throw<ArgumentNullException>(() => OrderMath.Compute(NoItems, null!, NoAmounts, NoAmounts))
            .ParamName.ShouldBe("discounts");
    }

    [Fact]
    public void NullPaymentsThrowsNamingTheParameter()
    {
        Should.Throw<ArgumentNullException>(() => OrderMath.Compute(NoItems, NoDiscounts, null!, NoAmounts))
            .ParamName.ShouldBe("payments");
    }

    [Fact]
    public void NullExpensesThrowsNamingTheParameter()
    {
        Should.Throw<ArgumentNullException>(() => OrderMath.Compute(NoItems, NoDiscounts, NoAmounts, null!))
            .ParamName.ShouldBe("expenses");
    }

    [Fact]
    public void AnEmptyOrderIsNotFullyPaid()
    {
        var result = OrderMath.Compute(NoItems, NoDiscounts, NoAmounts, NoAmounts);

        result.ShouldBe(new OrderMathResult(0m, 0m, 0m, 0m, 0m, 0m, 0m, FullyPaid: false));
    }

    [Fact]
    public void AZeroQuantityLineAddsNothing()
    {
        var result = OrderMath.Compute([new(0, 650m), new(2, 550m)], NoDiscounts, NoAmounts, NoAmounts);

        result.Subtotal.ShouldBe(1100m);
        result.Total.ShouldBe(1100m);
    }

    // PRD section 5.1 (owner ruling D-41 R2-06): Subtotal is before discount, Total = Subtotal - Discount,
    // Balance = Total - Paid and Profit = Total - Expenses.
    [Fact]
    public void TheTotalIsTheSubtotalMinusTheDiscount()
    {
        var result = OrderMath.Compute(
            [new(15, 650m), new(15, 300m), new(2, 550m), new(15, 420m), new(1, 800m)],
            [new(DiscountKind.Percentage, 5m), new(DiscountKind.Fixed, 100m)],
            [10_000m, 2_000m],
            [3_825m, 1_640m, 600m]);

        result.ShouldBe(new OrderMathResult(
            Subtotal: 22_450m,
            Discount: 1_222.50m,
            Total: 21_227.50m,
            Paid: 12_000m,
            Balance: 9_227.50m,
            Expenses: 6_065m,
            Profit: 15_162.50m,
            FullyPaid: false));
    }

    [Fact]
    public void APercentageOfAZeroTotalIsZero()
    {
        var result = OrderMath.Compute(NoItems, [new(DiscountKind.Percentage, 10m)], [5m], NoAmounts);

        result.Discount.ShouldBe(0m);
        result.Balance.ShouldBe(-5m);
        result.FullyPaid.ShouldBeFalse();
    }

    [Fact]
    public void AHundredPercentDiscountEqualsTheSubtotalAndTheBalanceIsMinusPaid()
    {
        var result = OrderMath.Compute(
            [new(3, 17m)],
            [new(DiscountKind.Percentage, 100m)],
            [20m],
            NoAmounts);

        result.Subtotal.ShouldBe(51m);
        result.Discount.ShouldBe(result.Subtotal);
        result.Total.ShouldBe(0m);
        result.Balance.ShouldBe(-20m);
        result.FullyPaid.ShouldBeTrue();
    }

    // Owner ruling D-41 R2-06 (2026-10-13), NET-IN-01 ruled keep: a fully discounted order with no payment is fully
    // paid, because its subtotal is above zero and nothing is owed.
    [Fact]
    public void AHundredPercentDiscountWithNoPaymentIsFullyPaid()
    {
        var result = OrderMath.Compute([new(3, 17m)], [new(DiscountKind.Percentage, 100m)], NoAmounts, NoAmounts);

        result.ShouldBe(new OrderMathResult(51m, 51m, 0m, 0m, 0m, 0m, 0m, FullyPaid: true));
    }

    [Fact]
    public void AZeroPercentDiscountAddsNothing()
    {
        var result = OrderMath.Compute([new(1, 17m)], [new(DiscountKind.Percentage, 0m)], NoAmounts, NoAmounts);

        result.Discount.ShouldBe(0m);
        result.Balance.ShouldBe(17m);
    }

    [Fact]
    public void PaymentsAboveTheTotalGiveANegativeBalance()
    {
        var result = OrderMath.Compute([new(1, 100m)], NoDiscounts, [100m, 50m], [30m]);

        result.Paid.ShouldBe(150m);
        result.Balance.ShouldBe(-50m);
        result.Profit.ShouldBe(70m);
        result.FullyPaid.ShouldBeTrue();
    }

    // Half away from zero at the centavo, never banker's rounding (D-09).
    [Theory]
    [InlineData("17.00", "7.5", "1.28")]
    [InlineData("51.00", "7.5", "3.83")]
    [InlineData("23.00", "2.5", "0.58")]
    [InlineData("1.16", "12.5", "0.15")]
    [InlineData("22450.00", "5", "1122.50")]
    public void RoundsAPercentageDiscountHalfAwayFromZero(string unitPrice, string percent, string expected)
    {
        var result = OrderMath.Compute(
            [new(1, Parse(unitPrice))],
            [new(DiscountKind.Percentage, Parse(percent))],
            NoAmounts,
            NoAmounts);

        result.Discount.ShouldBe(Parse(expected));
    }

    [Theory]
    [InlineData("1.005", "1.01")]
    [InlineData("10.075", "10.08")]
    [InlineData("0.125", "0.13")]
    public void RoundsAFixedDiscountHalfAwayFromZero(string value, string expected)
    {
        var result = OrderMath.Compute([new(1, 100m)], [new(DiscountKind.Fixed, Parse(value))], NoAmounts, NoAmounts);

        result.Discount.ShouldBe(Parse(expected));
    }

    [Fact]
    public void RoundsEachDiscountBeforeTheSum()
    {
        var result = OrderMath.Compute(
            [new(1, 100m)],
            [new(DiscountKind.Fixed, 1.005m), new(DiscountKind.Fixed, 1.005m)],
            NoAmounts,
            NoAmounts);

        result.Discount.ShouldBe(2.02m);
    }

    [Fact]
    public void ComputesTheLargestItemsTotalExactly()
    {
        var result = OrderMath.Compute(
            [new(1, 9_999_999_999.99m)],
            [new(DiscountKind.Percentage, 7.5m)],
            [9_999_999_999.99m],
            [9_999_999_999.99m]);

        result.Subtotal.ShouldBe(9_999_999_999.99m);
        result.Discount.ShouldBe(750_000_000.00m);
        result.Total.ShouldBe(9_249_999_999.99m);
        result.Balance.ShouldBe(-750_000_000.00m);
        result.Profit.ShouldBe(-750_000_000.00m);
    }

    // A kind that is out of range or never set (a bad cast, a mis-mapped legacy row, a deserializer default) must fail
    // loudly, never be valued as a fixed peso amount (NET-WR-01). The unset value 0 is no valid kind.
    [Theory]
    [InlineData(0)]
    [InlineData(99)]
    [InlineData(-1)]
    public void AnUndefinedDiscountKindThrowsNamingTheDiscount(int kind)
    {
        OrderMathDiscount[] discounts = [new((DiscountKind)kind, 10m)];

        var error = Should.Throw<ArgumentOutOfRangeException>(
            () => OrderMath.Compute([new(1, 100m)], discounts, NoAmounts, NoAmounts));

        error.ParamName.ShouldBe("discount");
        error.ActualValue.ShouldBe((DiscountKind)kind);
    }

    [Fact]
    public void ADiscountAmountRoundsSevenAndAHalfPercentOfSeventeenPesosHalfAwayFromZeroTo1Point28()
    {
        OrderMath.DiscountAmount(new(DiscountKind.Percentage, 7.5m), 17.00m).ShouldBe(1.28m);
    }

    [Fact]
    public void AFixedDiscountAmountIsTheValueItself()
    {
        OrderMath.DiscountAmount(new(DiscountKind.Fixed, 500.00m), 22_450.00m).ShouldBe(500.00m);
    }

    [Fact]
    public void AFivePercentDiscountAmountOfTheOrd0148SubtotalIs1122Point50()
    {
        OrderMath.DiscountAmount(new(DiscountKind.Percentage, 5m), 22_450.00m).ShouldBe(1122.50m);
    }

    [Fact]
    public void ADiscountAmountOfAnUndefinedKindThrowsNamingTheDiscount()
    {
        var error = Should.Throw<ArgumentOutOfRangeException>(() => OrderMath.DiscountAmount(new((DiscountKind)99, 10m), 100m));

        error.ParamName.ShouldBe("discount");
    }

    [Fact]
    public void ANullDiscountThrowsWhenItsAmountIsAsked()
    {
        Should.Throw<ArgumentNullException>(() => OrderMath.DiscountAmount(null!, 100m)).ParamName.ShouldBe("discount");
    }

    [Fact]
    public void TheDefaultDiscountKindIsNotAValidKind()
    {
        Enum.IsDefined(default(DiscountKind)).ShouldBeFalse();
    }

    private static decimal Parse(string value) => decimal.Parse(value, CultureInfo.InvariantCulture);
}
