using Csps.Application.OrderLists;
using Csps.Application.Ports;
using Csps.Domain.OrderLists;
using NSubstitute;

namespace Csps.Application.UnitTests.OrderLists;

/// <summary>D-19: a list is sorted A to Z ignoring case with Others last, and a retired entry stays listed with status retired.</summary>
public sealed class ListOrderListHandlerTests
{
    [Fact]
    public async Task EntriesAreSortedAToZIgnoringCaseWithOthersLastAndRetiredOnesKept()
    {
        var delivery = new OrderListEntryView(Guid.NewGuid(), "delivery", "success", Retired: false, IsOthers: false);
        var fabric = new OrderListEntryView(Guid.NewGuid(), "Fabric", "info", Retired: false, IsOthers: false);
        var labor = new OrderListEntryView(Guid.NewGuid(), "Labor", "warning", Retired: true, IsOthers: false);
        var others = new OrderListEntryView(Guid.NewGuid(), "Others", "neutral", Retired: false, IsOthers: true);
        var store = Substitute.For<IOrderLists>();
        store.ListAsync(OrderListKind.OrderExpenseCategory, TestContext.Current.CancellationToken).Returns([others, labor, fabric, delivery]);

        var result = await new ListOrderListHandler(store).HandleAsync(OrderListKind.OrderExpenseCategory, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(
        [
            new OrderListItem(delivery.Id, "delivery", "success", "active", false),
            new OrderListItem(fabric.Id, "Fabric", "info", "active", false),
            new OrderListItem(labor.Id, "Labor", "warning", "retired", false),
            new OrderListItem(others.Id, "Others", "neutral", "active", true),
        ]);
    }

    [Fact]
    public async Task EntriesWithTheSameNameAreOrderedById()
    {
        var low = new OrderListEntryView(new Guid("00000000-0000-0000-0000-000000000001"), "Same", "neutral", Retired: false, IsOthers: false);
        var high = new OrderListEntryView(new Guid("00000000-0000-0000-0000-000000000002"), "same", "neutral", Retired: false, IsOthers: false);
        var store = Substitute.For<IOrderLists>();
        store.ListAsync(OrderListKind.ProductType, TestContext.Current.CancellationToken).Returns([high, low]);

        var result = await new ListOrderListHandler(store).HandleAsync(OrderListKind.ProductType, TestContext.Current.CancellationToken);

        result.Value.Select(item => item.Id).ShouldBe([low.Id, high.Id]);
    }

    [Fact]
    public async Task AnEmptyListIsAnEmptyResult()
    {
        var store = Substitute.For<IOrderLists>();
        store.ListAsync(OrderListKind.PaymentMethod, TestContext.Current.CancellationToken).Returns([]);

        var result = await new ListOrderListHandler(store).HandleAsync(OrderListKind.PaymentMethod, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(OrderListKind.ProductType, "product-types", "ProductType", "product type")]
    [InlineData(OrderListKind.PaymentMethod, "payment-methods", "PaymentMethod", "payment method")]
    [InlineData(OrderListKind.OrderExpenseCategory, "order-expense-categories", "OrderExpenseCategory", "category")]
    public void EachListHasItsDescriptor(OrderListKind kind, string route, string target, string noun)
    {
        var descriptor = OrderListDescriptor.For(kind);

        descriptor.Kind.ShouldBe(kind);
        descriptor.RouteSegment.ShouldBe(route);
        descriptor.AuditTargetType.ShouldBe(target);
        descriptor.Noun.ShouldBe(noun);
    }

    [Fact]
    public void AnUnknownListHasNoDescriptor()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => OrderListDescriptor.For((OrderListKind)0));
    }
}
