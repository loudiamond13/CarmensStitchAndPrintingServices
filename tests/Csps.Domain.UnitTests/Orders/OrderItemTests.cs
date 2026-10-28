using Csps.Domain.Common;
using Csps.Domain.Expenses;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>ORD-05, ORD-13, D-30, D-31: adding, editing and removing items re-checks every rule, keeps at least one and at most 100 items, and recomputes the totals.</summary>
public sealed class OrderItemTests
{
    private static readonly DateTimeOffset Created = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = new(2026, 10, 29, 3, 0, 0, TimeSpan.Zero);
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid PoloType = Guid.Parse("01a17fce-7801-7e45-b875-357767854eda");

    private static readonly (string Path, string Message, Func<NewOrderItem, NewOrderItem> BreakIt)[] BrokenItems =
    [
        ("items[1].productTypeId", OrderRules.ProductTypeRequired, item => item with { ProductTypeId = Guid.Empty }),
        ("items[1].description", OrderRules.DescriptionRequired, item => item with { Description = "  " }),
        ("items[1].description", OrderRules.DescriptionTooLong, item => item with { Description = new string('a', 201) }),
        ("items[1].sizeVariant", OrderRules.SizeVariantTooLong, item => item with { SizeVariant = new string('a', 101) }),
        ("items[1].quantity", OrderRules.QuantityOutOfRange, item => item with { Quantity = 0 }),
        ("items[1].quantity", OrderRules.QuantityOutOfRange, item => item with { Quantity = 10_001 }),
        ("items[1].unitPrice", OrderRules.UnitPriceOutOfRange, item => item with { UnitPrice = -0.01m }),
        ("items[1].unitPrice", OrderRules.UnitPriceOutOfRange, item => item with { UnitPrice = 1_000_000.01m }),
        ("items[1].unitPrice", OrderRules.MoneyDecimals, item => item with { UnitPrice = 10.005m }),
    ];

    [Fact]
    public void AddingAnItemAppendsItAfterTheLastOneAndRecomputesTheTotals()
    {
        var order = OrderOf(Jersey(15, 650.00m));
        var editVersion = order.EditVersion;

        var result = order.AddItem(new NewOrderItem(PoloType, "  Coach polo ", " L ", 2, 550.00m), Later);

        result.IsSuccess.ShouldBeTrue();
        var added = result.Value;
        added.Description.ShouldBe("Coach polo");
        added.SizeVariant.ShouldBe("L");
        added.LineTotal.ShouldBe(1100.00m);
        added.Position.ShouldBe(1);
        added.OrderId.ShouldBe(order.Id);
        added.Order.ShouldBeSameAs(order);
        order.Items.Count.ShouldBe(2);
        order.Subtotal.ShouldBe(10850.00m);
        order.Total.ShouldBe(10850.00m);
        order.Balance.ShouldBe(10850.00m);
        order.EditVersion.ShouldNotBe(editVersion);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void EachBrokenItemFieldIsRefusedWithItsMessageAndNothingIsAdded()
    {
        foreach (var (path, message, breakIt) in BrokenItems)
        {
            var order = OrderOf(Jersey(15, 650.00m));
            var editVersion = order.EditVersion;

            var result = order.AddItem(breakIt(new NewOrderItem(PoloType, "Coach polo", "L", 2, 550.00m)), Later);

            result.IsFailure.ShouldBeTrue(message);
            result.Error.Kind.ShouldBe(ErrorKind.Validation, message);
            var fields = result.Error.FieldErrors.ShouldNotBeNull();
            fields.Keys.ShouldBe([path], message);
            fields[path].ShouldBe([message]);
            order.Items.Count.ShouldBe(1, message);
            order.EditVersion.ShouldBe(editVersion, message);
        }
    }

    [Fact]
    public void AHundredAndFirstItemIsRefusedAndTheHundredthIsAccepted()
    {
        var order = OrderOf([.. Enumerable.Range(0, 99).Select(_ => Jersey(1, 10.00m))]);

        var hundredth = order.AddItem(Jersey(1, 10.00m), Later);
        var editVersion = order.EditVersion;
        var hundredAndFirst = order.AddItem(Jersey(1, 10.00m), Later.AddHours(1));

        hundredth.IsSuccess.ShouldBeTrue();
        hundredAndFirst.IsFailure.ShouldBeTrue();
        hundredAndFirst.Error.ShouldBe(OrderRules.TooManyItems);
        hundredAndFirst.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        hundredAndFirst.Error.Code.ShouldBe("orders.too-many-items");
        hundredAndFirst.Error.Message.ShouldBe("An order can have at most 100 items.");
        order.Items.Count.ShouldBe(100);
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void ANewItemGoesAfterTheHighestPositionEvenWhenAnEarlierOneWasRemoved()
    {
        var order = OrderOf(Jersey(1, 10.00m), Jersey(2, 20.00m), Jersey(3, 30.00m));
        order.RemoveItem(order.Items[0].Id, Later).IsSuccess.ShouldBeTrue();

        var added = order.AddItem(Jersey(4, 40.00m), Later.AddHours(1)).Value;

        order.Items.Select(static item => item.Position).ShouldBe([1, 2, 3]);
        added.Position.ShouldBe(3);
    }

    [Fact]
    public void UpdatingAnItemReportsEveryChangedPairAndTheChangedTextFieldNames()
    {
        var order = OrderOf(Jersey(15, 650.00m));
        var item = order.Items[0];
        var editVersion = order.EditVersion;

        var result = order.UpdateItem(item.Id, new NewOrderItem(PoloType, " Warm-up ", "XL", 20, 700.00m), Later);

        result.IsSuccess.ShouldBeTrue();
        var changes = result.Value;
        changes.ProductType.ShouldBe(new ValueChange<Guid>(JerseyType, PoloType));
        changes.Quantity.ShouldBe(new ValueChange<int>(15, 20));
        changes.UnitPrice.ShouldBe(new ValueChange<decimal>(650.00m, 700.00m));
        changes.ChangedFields.ShouldBe(["description", "sizeVariant"]);
        changes.HasAny.ShouldBeTrue();
        item.ProductTypeId.ShouldBe(PoloType);
        item.Description.ShouldBe("Warm-up");
        item.SizeVariant.ShouldBe("XL");
        item.Quantity.ShouldBe(20);
        item.UnitPrice.ShouldBe(700.00m);
        item.LineTotal.ShouldBe(14000.00m);
        order.Subtotal.ShouldBe(14000.00m);
        order.EditVersion.ShouldNotBe(editVersion);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void OnlyTheFieldsThatChangedAreReported()
    {
        var order = OrderOf(Jersey(15, 650.00m));
        var item = order.Items[0];

        var quantityOnly = order.UpdateItem(item.Id, Jersey(16, 650.00m), Later).Value;
        var textOnly = order.UpdateItem(item.Id, Jersey(16, 650.00m) with { Description = "Jersey shirt" }, Later.AddHours(1)).Value;
        var sizeCleared = order.UpdateItem(item.Id, Jersey(16, 650.00m) with { Description = "Jersey shirt", SizeVariant = null }, Later.AddHours(2)).Value;

        quantityOnly.ProductType.ShouldBeNull();
        quantityOnly.Quantity.ShouldBe(new ValueChange<int>(15, 16));
        quantityOnly.UnitPrice.ShouldBeNull();
        quantityOnly.ChangedFields.ShouldBeEmpty();
        textOnly.Quantity.ShouldBeNull();
        textOnly.ChangedFields.ShouldBe(["description"]);
        sizeCleared.ChangedFields.ShouldBe(["sizeVariant"]);
        item.SizeVariant.ShouldBeNull();
    }

    [Fact]
    public void AChangedPriceAloneAndAChangedProductTypeAloneEachCountAsAChange()
    {
        var order = OrderOf(Jersey(15, 650.00m));
        var item = order.Items[0];

        var priceOnly = order.UpdateItem(item.Id, Jersey(15, 700.00m), Later).Value;
        var typeOnly = order.UpdateItem(item.Id, new NewOrderItem(PoloType, "Jersey top", "S-XL", 15, 700.00m), Later.AddHours(1)).Value;

        priceOnly.HasAny.ShouldBeTrue();
        priceOnly.UnitPrice.ShouldBe(new ValueChange<decimal>(650.00m, 700.00m));
        priceOnly.Quantity.ShouldBeNull();
        typeOnly.HasAny.ShouldBeTrue();
        typeOnly.ProductType.ShouldBe(new ValueChange<Guid>(JerseyType, PoloType));
        typeOnly.UnitPrice.ShouldBeNull();
    }

    [Fact]
    public void AnUpdateThatChangesNothingReportsNothingAndKeepsTheVersion()
    {
        var order = OrderOf(Jersey(15, 650.00m));
        var editVersion = order.EditVersion;

        var result = order.UpdateItem(order.Items[0].Id, new NewOrderItem(JerseyType, " Jersey top ", " S-XL ", 15, 650.00m), Later);

        result.IsSuccess.ShouldBeTrue();
        result.Value.HasAny.ShouldBeFalse();
        order.EditVersion.ShouldBe(editVersion);
        order.Subtotal.ShouldBe(9750.00m);
    }

    [Fact]
    public void EachBrokenFieldIsRefusedOnUpdateAndNothingIsAssigned()
    {
        foreach (var (_, message, breakIt) in BrokenItems)
        {
            var order = OrderOf(Jersey(15, 650.00m));
            var editVersion = order.EditVersion;

            var result = order.UpdateItem(order.Items[0].Id, breakIt(Jersey(16, 650.00m)), Later);

            result.IsFailure.ShouldBeTrue(message);
            result.Error.Kind.ShouldBe(ErrorKind.Validation, message);
            order.Items[0].Quantity.ShouldBe(15, message);
            order.EditVersion.ShouldBe(editVersion, message);
        }
    }

    [Fact]
    public void AnUnknownItemIdIsNotFoundOnUpdateAndOnRemove()
    {
        var order = OrderOf(Jersey(15, 650.00m), Jersey(1, 100.00m));
        var editVersion = order.EditVersion;

        var update = order.UpdateItem(Guid.NewGuid(), Jersey(16, 650.00m), Later);
        var remove = order.RemoveItem(Guid.NewGuid(), Later);

        update.Error.ShouldBe(OrderRules.ItemNotFound);
        remove.Error.ShouldBe(OrderRules.ItemNotFound);
        update.Error.Kind.ShouldBe(ErrorKind.NotFound);
        update.Error.Code.ShouldBe("orders.item-not-found");
        update.Error.Message.ShouldBe("This item was not found on this order.");
        order.Items.Count.ShouldBe(2);
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void RemovingAnItemTakesItOutRecomputesTheTotalsAndGivesTheRemovedItemBack()
    {
        var order = OrderOf(Jersey(15, 650.00m), new NewOrderItem(PoloType, "Coach polo", "L", 2, 550.00m));
        var polo = order.Items[1];
        var editVersion = order.EditVersion;

        var result = order.RemoveItem(polo.Id, Later);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBeSameAs(polo);
        order.Items.Count.ShouldBe(1);
        order.Subtotal.ShouldBe(9750.00m);
        order.EditVersion.ShouldNotBe(editVersion);
        AssertTotalsMatchOrderMath(order);
    }

    [Fact]
    public void RemovingTheLastItemIsRefusedAndTheOrderIsUnchanged()
    {
        var order = OrderOf(Jersey(15, 650.00m));
        var editVersion = order.EditVersion;

        var result = order.RemoveItem(order.Items[0].Id, Later);

        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBe(OrderRules.LastItem);
        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Code.ShouldBe("orders.last-item");
        result.Error.Message.ShouldBe("An order needs at least one item. Add another item before removing this one.");
        order.Items.Count.ShouldBe(1);
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void ARemovalOfAnUnknownIdOnAOneItemOrderIsNotFoundNotLastItem()
    {
        var order = OrderOf(Jersey(15, 650.00m));

        order.RemoveItem(Guid.NewGuid(), Later).Error.ShouldBe(OrderRules.ItemNotFound);
    }

    private static NewOrderItem Jersey(int quantity, decimal unitPrice) => new(JerseyType, "Jersey top", "S-XL", quantity, unitPrice);

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
        var figures = OrderMath.Compute([.. order.Items.Select(static item => new OrderMathItem(item.Quantity, item.UnitPrice))], [], [], [], [], cancelled: false);
        order.Subtotal.ShouldBe(figures.Subtotal);
        order.Total.ShouldBe(figures.Total);
        order.Balance.ShouldBe(figures.Balance);
        order.Profit.ShouldBe(figures.Profit);
        order.Items.ShouldAllBe(static item => item.LineTotal == item.Quantity * item.UnitPrice);
    }
}
