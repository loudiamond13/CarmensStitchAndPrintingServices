using Csps.Application.Orders;
using Csps.Domain.Auditing;
using Csps.Domain.Orders;

namespace Csps.Application.UnitTests.Orders;

/// <summary>D-31, 05 D-40, T-07-12: the order.created detail holds the number, status, dates, item count and total, and never customer text.</summary>
public sealed class OrderAuditDetailTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);

    [Fact]
    public void CreatedHoldsExactlyTheDocumentedKeysInOrder()
    {
        var order = NewOrder("ORD-2026-0001");

        var detail = OrderAuditDetail.Created(order);

        detail.ShouldBe("number=ORD-2026-0001;status=pending;orderDate=2026-10-28;dueDate=2026-11-11;items=1;total=9750.00");
        detail.Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void CreatedNamesTheStatusByItsWireKeyAndCountsEveryItem()
    {
        var items = new[]
        {
            new NewOrderItem(Guid.NewGuid(), "Jersey top", null, 15, 650.00m),
            new NewOrderItem(Guid.NewGuid(), "Banner", null, 1, 800.00m),
        };
        var order = Order.Create(new NewOrder(Details(), OrderStatus.InProduction, items), Guid.NewGuid(), Now).Value;
        order.AssignNumber("ORD-2026-0148");

        OrderAuditDetail.Created(order).ShouldBe("number=ORD-2026-0148;status=production;orderDate=2026-10-28;dueDate=2026-11-11;items=2;total=10550.00");
    }

    [Fact]
    public void CreatedHoldsNoCustomerTeamContactEmailAddressOrNotesText()
    {
        var order = NewOrder("ORD-2026-0001");

        var detail = OrderAuditDetail.Created(order);

        foreach (var secret in new[] { "Juan", "Dela Cruz", "Ballers", "0917", "juan.dc", "Brgy.", "rush", "Jersey top" })
        {
            detail.ShouldNotContain(secret, Case.Insensitive);
        }
    }

    [Fact]
    public void ANullOrderIsAProgrammingError() => Should.Throw<ArgumentNullException>(() => OrderAuditDetail.Created(null!));

    private static Order NewOrder(string number)
    {
        var items = new[] { new NewOrderItem(Guid.NewGuid(), "Jersey top", "S-XL", 15, 650.00m) };
        var order = Order.Create(new NewOrder(Details(), OrderStatus.Pending, items), Guid.NewGuid(), Now).Value;
        order.AssignNumber(number);
        return order;
    }

    private static OrderDetails Details() => new(
        "Juan Dela Cruz",
        "Brgy. San Roque Ballers",
        "0917 123 4567",
        "juan.dc@example.com",
        "Brgy. San Roque",
        new DateOnly(2026, 10, 28),
        new DateOnly(2026, 11, 11),
        "rush job");
}
