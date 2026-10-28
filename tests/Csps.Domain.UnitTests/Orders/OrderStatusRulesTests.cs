using Csps.Domain.Common;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>The seven stored statuses and the owner's transition table (D-01 to D-05, D-13, D-38).</summary>
public sealed class OrderStatusRulesTests
{
    [Fact]
    public void StoredStatusNumbersAreFixed()
    {
        ((byte)OrderStatus.Pending).ShouldBe((byte)1);
        ((byte)OrderStatus.Mockup).ShouldBe((byte)2);
        ((byte)OrderStatus.InProduction).ShouldBe((byte)3);
        ((byte)OrderStatus.Ready).ShouldBe((byte)4);
        ((byte)OrderStatus.Delivered).ShouldBe((byte)5);
        ((byte)OrderStatus.Completed).ShouldBe((byte)6);
        ((byte)OrderStatus.Cancelled).ShouldBe((byte)7);
    }

    [Fact]
    public void PendingMovesToCompletedWhenTheBalanceIsZero()
    {
        var result = OrderStatusRules.Check(OrderStatus.Pending, OrderStatus.Completed, 0.00m);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(OrderStatusMove.Move);
    }

    [Fact]
    public void PendingCannotBeCompletedWhileMoneyIsOwed()
    {
        var result = OrderStatusRules.Check(OrderStatus.Pending, OrderStatus.Completed, 9_327.50m);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe("orders.complete-balance-owed");
        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Message.ShouldBe("This order still has ₱9,327.50 to pay. Record the payment first.");
    }

    // Rows are the current status, columns the requested one, both in stored order Pending to Cancelled (balance 0.00).
    // = no change, M move, R reopen, C refused (reopen, then cancel), K refused (reopen, then complete).
    private static readonly string[] Table =
    [
        "=MMMMMM",
        "M=MMMMM",
        "MM=MMMM",
        "MMM=MMM",
        "MMMM=MM",
        "RRRRR=C",
        "RRRRRK=",
    ];

    public static TheoryData<OrderStatus, OrderStatus, char> AllPairs()
    {
        var data = new TheoryData<OrderStatus, OrderStatus, char>();
        for (var from = 1; from <= 7; from++)
        {
            for (var to = 1; to <= 7; to++)
            {
                data.Add((OrderStatus)from, (OrderStatus)to, Table[from - 1][to - 1]);
            }
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(AllPairs))]
    public void EveryPairFollowsTheOwnersTable(OrderStatus from, OrderStatus to, char expected)
    {
        var result = OrderStatusRules.Check(from, to, 0.00m);

        switch (expected)
        {
            case '=':
                result.IsSuccess.ShouldBeTrue();
                result.Value.ShouldBe(OrderStatusMove.NoChange);
                break;
            case 'M':
                result.IsSuccess.ShouldBeTrue();
                result.Value.ShouldBe(OrderStatusMove.Move);
                break;
            case 'R':
                result.IsSuccess.ShouldBeTrue();
                result.Value.ShouldBe(OrderStatusMove.Reopen);
                break;
            case 'C':
                result.IsFailure.ShouldBeTrue();
                result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
                result.Error.Code.ShouldBe("orders.reopen-first");
                result.Error.Message.ShouldBe("Reopen the order first, then cancel it.");
                break;
            default:
                result.IsFailure.ShouldBeTrue();
                result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
                result.Error.Code.ShouldBe("orders.reopen-first");
                result.Error.Message.ShouldBe("Reopen the order first, then mark it Completed.");
                break;
        }
    }

    [Theory]
    [InlineData(OrderStatus.Pending)]
    [InlineData(OrderStatus.Mockup)]
    [InlineData(OrderStatus.InProduction)]
    [InlineData(OrderStatus.Ready)]
    [InlineData(OrderStatus.Delivered)]
    public void AnActiveOrderCannotBeCompletedWithACustomerCredit(OrderStatus from)
    {
        var result = OrderStatusRules.Check(from, OrderStatus.Completed, -0.01m);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Code.ShouldBe("orders.complete-credit");
        result.Error.Message.ShouldBe("This order has a customer credit of ₱0.01. Record a refund first.");
    }

    [Theory]
    [InlineData(OrderStatus.Pending)]
    [InlineData(OrderStatus.Delivered)]
    public void AnActiveOrderCannotBeCompletedByASmallDebt(OrderStatus from)
    {
        var result = OrderStatusRules.Check(from, OrderStatus.Completed, 0.01m);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe("orders.complete-balance-owed");
        result.Error.Message.ShouldBe("This order still has ₱0.01 to pay. Record the payment first.");
    }

    [Theory]
    [InlineData(OrderStatus.Pending)]
    [InlineData(OrderStatus.Mockup)]
    [InlineData(OrderStatus.InProduction)]
    [InlineData(OrderStatus.Ready)]
    [InlineData(OrderStatus.Delivered)]
    public void CancellingIgnoresTheBalance(OrderStatus from)
    {
        OrderStatusRules.Check(from, OrderStatus.Cancelled, 9_327.50m).Value.ShouldBe(OrderStatusMove.Move);
        OrderStatusRules.Check(from, OrderStatus.Cancelled, -200m).Value.ShouldBe(OrderStatusMove.Move);
    }

    [Theory]
    [InlineData(OrderStatus.Completed, OrderStatus.Pending, 500)]
    [InlineData(OrderStatus.Completed, OrderStatus.Delivered, -500)]
    [InlineData(OrderStatus.Cancelled, OrderStatus.Mockup, 500)]
    [InlineData(OrderStatus.Cancelled, OrderStatus.Ready, -500)]
    public void ReopeningNeedsNoBalanceCheck(OrderStatus from, OrderStatus to, int balance) =>
        OrderStatusRules.Check(from, to, balance).Value.ShouldBe(OrderStatusMove.Reopen);

    [Theory]
    [InlineData(OrderStatus.Completed, OrderStatus.Cancelled, 500)]
    [InlineData(OrderStatus.Cancelled, OrderStatus.Completed, 500)]
    [InlineData(OrderStatus.Cancelled, OrderStatus.Completed, -500)]
    public void TheDirectEndStateSwapIsRefusedWhateverTheBalance(OrderStatus from, OrderStatus to, int balance) =>
        OrderStatusRules.Check(from, to, balance).Error.Code.ShouldBe("orders.reopen-first");

    [Theory]
    [InlineData(OrderStatus.Completed, 500)]
    [InlineData(OrderStatus.Cancelled, -500)]
    public void ASameStatusRequestIsNoChangeEvenWithABalance(OrderStatus status, int balance)
    {
        var result = OrderStatusRules.Check(status, status, balance);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(OrderStatusMove.NoChange);
    }

    [Theory]
    [InlineData(0, 1, "from")]
    [InlineData(8, 1, "from")]
    [InlineData(1, 0, "to")]
    [InlineData(1, 8, "to")]
    public void AnUndefinedStatusThrows(int from, int to, string parameter)
    {
        var thrown = Should.Throw<ArgumentOutOfRangeException>(
            () => OrderStatusRules.Check((OrderStatus)from, (OrderStatus)to, 0m));

        thrown.ParamName.ShouldBe(parameter);
    }

    [Theory]
    [InlineData(OrderStatus.Pending, true, false)]
    [InlineData(OrderStatus.Mockup, true, false)]
    [InlineData(OrderStatus.InProduction, true, false)]
    [InlineData(OrderStatus.Ready, true, false)]
    [InlineData(OrderStatus.Delivered, true, false)]
    [InlineData(OrderStatus.Completed, false, true)]
    [InlineData(OrderStatus.Cancelled, false, true)]
    public void OnlyCompletedAndCancelledAreLocked(OrderStatus status, bool active, bool locked)
    {
        OrderStatusRules.IsActive(status).ShouldBe(active);
        OrderStatusRules.IsLocked(status).ShouldBe(locked);
    }

    [Fact]
    public void ActiveStatusesListsTheFiveInStoredOrder() =>
        OrderStatusRules.ActiveStatuses.ShouldBe(
            [OrderStatus.Pending, OrderStatus.Mockup, OrderStatus.InProduction, OrderStatus.Ready, OrderStatus.Delivered]);
}
