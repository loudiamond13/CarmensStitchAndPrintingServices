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

        result.ShouldBe(new OrderMathResult(0m, 0m, 0m, 0m, 0m, 0m, FullyPaid: false));
    }

    [Fact]
    public void AZeroQuantityLineAddsNothing()
    {
        var result = OrderMath.Compute([new(0, 650m), new(2, 550m)], NoDiscounts, NoAmounts, NoAmounts);

        result.Total.ShouldBe(1100m);
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
    public void AHundredPercentDiscountEqualsTheTotalAndTheBalanceIsMinusPaid()
    {
        var result = OrderMath.Compute(
            [new(3, 17m)],
            [new(DiscountKind.Percentage, 100m)],
            [20m],
            NoAmounts);

        result.Discount.ShouldBe(result.Total);
        result.Balance.ShouldBe(-20m);
        result.FullyPaid.ShouldBeTrue();
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

        result.Total.ShouldBe(9_999_999_999.99m);
        result.Discount.ShouldBe(750_000_000.00m);
        result.Balance.ShouldBe(-750_000_000.00m);
        result.Profit.ShouldBe(-750_000_000.00m);
    }

    private static decimal Parse(string value) => decimal.Parse(value, CultureInfo.InvariantCulture);
}
