using System.Globalization;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>Refunds, customer credit and the cancelled-order profit rule (ORD-20, D-10, D-12, D-13, D-36).</summary>
public sealed class OrderMathRefundTests
{
    private static readonly decimal[] NoAmounts = [];
    private static readonly OrderMathDiscount[] NoDiscounts = [];

    // ORD-2026-0148 with its 5% discount: the order the PRD and the golden vectors are built on.
    private static readonly OrderMathItem[] Order0148Items =
        [new(15, 650m), new(15, 300m), new(2, 550m), new(15, 420m), new(1, 800m)];

    private static readonly OrderMathDiscount[] Order0148Discounts = [new(DiscountKind.Percentage, 5m)];
    private static readonly decimal[] Order0148Payments = [10_000m, 2_000m];
    private static readonly decimal[] Order0148Expenses = [3_825m, 1_640m, 600m];

    [Fact]
    public void OrderZeroOneFourEightWithNoRefundsKeepsTheV2FiguresAndAddsZeroRefundedAndCredit()
    {
        var result = OrderMath.Compute(
            Order0148Items,
            Order0148Discounts,
            Order0148Payments,
            NoAmounts,
            Order0148Expenses,
            cancelled: false);

        result.ShouldBe(new OrderMathResult(
            Subtotal: 22_450m,
            Discount: 1_122.50m,
            Total: 21_327.50m,
            Paid: 12_000m,
            Balance: 9_327.50m,
            Expenses: 6_065m,
            Profit: 15_262.50m,
            FullyPaid: false)
        {
            Refunded = 0m,
            CustomerCredit = 0m,
        });
    }

    [Fact]
    public void ACancelledOrderFullyRefundedShowsALossOfItsExpenses()
    {
        var result = OrderMath.Compute(
            Order0148Items,
            Order0148Discounts,
            Order0148Payments,
            [12_000m],
            Order0148Expenses,
            cancelled: true);

        result.Refunded.ShouldBe(12_000m);
        result.Balance.ShouldBe(21_327.50m);
        result.CustomerCredit.ShouldBe(0m);
        result.Profit.ShouldBe(-6_065m);
        result.FullyPaid.ShouldBeFalse();
    }

    [Fact]
    public void ACancelledOrderWithNoRefundsKeepsWhatWasPaidAsProfitMinusExpenses()
    {
        var result = OrderMath.Compute(
            Order0148Items,
            Order0148Discounts,
            Order0148Payments,
            NoAmounts,
            Order0148Expenses,
            cancelled: true);

        result.Profit.ShouldBe(5_935m);
    }

    [Fact]
    public void ANotCancelledOrderIgnoresRefundsForProfit()
    {
        var result = OrderMath.Compute(
            Order0148Items,
            Order0148Discounts,
            Order0148Payments,
            [500m],
            Order0148Expenses,
            cancelled: false);

        result.Refunded.ShouldBe(500m);
        result.Balance.ShouldBe(9_827.50m);
        result.Profit.ShouldBe(15_262.50m);
    }

    [Fact]
    public void PayingMoreThanTheTotalLeavesTheCustomerCredit()
    {
        var result = OrderMath.Compute([new(1, 1_000m)], NoDiscounts, [1_200m], NoAmounts, NoAmounts, cancelled: false);

        result.Balance.ShouldBe(-200m);
        result.CustomerCredit.ShouldBe(200m);
        result.FullyPaid.ShouldBeTrue();
    }

    [Fact]
    public void RefundingTheOverpaymentClearsTheBalanceAndTheCredit()
    {
        var result = OrderMath.Compute([new(1, 1_000m)], NoDiscounts, [1_200m], [200m], NoAmounts, cancelled: false);

        result.Refunded.ShouldBe(200m);
        Text(result.Balance).ShouldBe("0.00");
        Text(result.CustomerCredit).ShouldBe("0.00");
        result.FullyPaid.ShouldBeTrue();
    }

    [Fact]
    public void AnExactlyPaidOrderHasNoCreditAndIsFullyPaid()
    {
        var result = OrderMath.Compute([new(1, 1_000m)], NoDiscounts, [1_000m], NoAmounts, NoAmounts, cancelled: false);

        Text(result.Balance).ShouldBe("0.00");
        Text(result.CustomerCredit).ShouldBe("0.00");
        result.FullyPaid.ShouldBeTrue();
    }

    [Fact]
    public void AnOwedBalanceHasNoCredit()
    {
        var result = OrderMath.Compute([new(1, 1_000m)], NoDiscounts, [400m], NoAmounts, NoAmounts, cancelled: false);

        result.Balance.ShouldBe(600m);
        result.CustomerCredit.ShouldBe(0m);
    }

    [Fact]
    public void RefundsAreSummedThenRoundedHalfAwayFromZero()
    {
        var result = OrderMath.Compute([new(1, 100m)], NoDiscounts, [100m], [0.005m, 0.005m], NoAmounts, cancelled: false);

        result.Refunded.ShouldBe(0.01m);
    }

    [Fact]
    public void ANullRefundsListThrowsNamingTheParameter()
    {
        Should.Throw<ArgumentNullException>(
                () => OrderMath.Compute([], [], NoAmounts, null!, NoAmounts, cancelled: false))
            .ParamName.ShouldBe("refunds");
    }

    [Fact]
    public void AnEmptyRefundsListAndNotCancelledGivesTheFourArgumentResult()
    {
        var four = OrderMath.Compute(Order0148Items, Order0148Discounts, Order0148Payments, Order0148Expenses);
        var six = OrderMath.Compute(
            Order0148Items,
            Order0148Discounts,
            Order0148Payments,
            NoAmounts,
            Order0148Expenses,
            cancelled: false);

        six.ShouldBe(four);
    }

    private static string Text(decimal amount) => amount.ToString("0.00", CultureInfo.InvariantCulture);
}
