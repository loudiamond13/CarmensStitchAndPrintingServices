using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>ORD-06, D-26, D-28: an order is only marked deleted, the mark can be cleared, and neither step happens twice.</summary>
public sealed class OrderDeletionTests
{
    private static readonly DateTimeOffset Created = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = new(2026, 10, 29, 3, 0, 0, TimeSpan.Zero);
    private static readonly Guid Admin = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid Manager = Guid.Parse("2f9a6d10-58b3-4c7e-8a41-d03e7b95c628");

    [Fact]
    public void ANewOrderIsNotDeleted()
    {
        var order = NewOrder();

        order.IsDeleted.ShouldBeFalse();
        order.DeletedAtUtc.ShouldBeNull();
        order.DeletedById.ShouldBeNull();
    }

    [Fact]
    public void SoftDeleteSetsThePairOnceAndAnotherCallChangesNothing()
    {
        var order = NewOrder();

        order.SoftDelete(Admin, Later).ShouldBeTrue();
        order.SoftDelete(Manager, Later.AddHours(1)).ShouldBeFalse();

        order.IsDeleted.ShouldBeTrue();
        order.DeletedAtUtc.ShouldBe(Later);
        order.DeletedById.ShouldBe(Admin);
    }

    [Theory]
    [InlineData(OrderStatus.Completed)]
    [InlineData(OrderStatus.Cancelled)]
    public void AnOrderInAnEndStateCanBeDeletedWithoutAReopen(OrderStatus endState)
    {
        var order = NewOrder();
        order.ChangeStatus(endState, Admin, Created).IsSuccess.ShouldBeTrue();

        order.SoftDelete(Admin, Later).ShouldBeTrue();

        order.IsDeleted.ShouldBeTrue();
        order.Status.ShouldBe(endState);
    }

    [Fact]
    public void RestoreClearsThePairAndAnotherCallChangesNothing()
    {
        var order = NewOrder();
        order.SoftDelete(Admin, Later).ShouldBeTrue();

        order.Restore().ShouldBeTrue();
        order.Restore().ShouldBeFalse();

        order.IsDeleted.ShouldBeFalse();
        order.DeletedAtUtc.ShouldBeNull();
        order.DeletedById.ShouldBeNull();
    }

    [Fact]
    public void RestoreOfAnOrderThatWasNeverDeletedChangesNothing()
    {
        var order = NewOrder();

        order.Restore().ShouldBeFalse();

        order.IsDeleted.ShouldBeFalse();
    }

    [Fact]
    public void AnOrderCanBeDeletedAndRestoredMoreThanOnce()
    {
        var order = NewOrder();

        order.SoftDelete(Admin, Later).ShouldBeTrue();
        order.Restore().ShouldBeTrue();
        order.SoftDelete(Manager, Later.AddDays(1)).ShouldBeTrue();

        order.DeletedAtUtc.ShouldBe(Later.AddDays(1));
        order.DeletedById.ShouldBe(Manager);
    }

    private static Order NewOrder()
    {
        var details = new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null);
        var items = new[] { new NewOrderItem(Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6"), "Jersey top", "S-XL", 15, 650.00m) };
        var today = new DateOnly(2026, 10, 28);
        var payments = new[] { new NewOrderPayment(today, 9750.00m, Guid.Parse("01a17fce-7806-77e1-91b7-d3b852f2fd1d"), null, null, Manager) };
        var order = Order.Create(new NewOrder(details, OrderStatus.Pending, items) { Payments = payments }, Admin, Created, today).Value;
        order.AssignNumber("ORD-2026-0001");
        return order;
    }
}
