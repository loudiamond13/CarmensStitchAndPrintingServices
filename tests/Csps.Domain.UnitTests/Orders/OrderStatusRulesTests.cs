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
}
