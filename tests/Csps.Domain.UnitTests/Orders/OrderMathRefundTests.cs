using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>Refunds, customer credit and the cancelled-order profit rule (ORD-20, D-10, D-12, D-13, D-36).</summary>
public sealed class OrderMathRefundTests
{
    private static readonly decimal[] NoAmounts = [];

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
}
