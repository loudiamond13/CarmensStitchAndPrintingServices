using Csps.Domain.Common;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>ORD-03, ORD-13, ORD-16, ORD-20, D-21, D-22, D-30: the order checks every rule at its boundary and works its own money.</summary>
public sealed class OrderTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid ProductTypeId = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly DateOnly OrderDay = new(2026, 10, 28);

    [Fact]
    public void ABoundaryValidOrderIsCreatedWithTrimmedTextAndNoNumber()
    {
        var details = ValidDetails() with
        {
            CustomerName = "  Juan Dela Cruz  ",
            TeamName = "  Ballers ",
            ContactNumber = " +63 (917) 123-4567 ",
            Email = " juan.dc@example.com ",
            Address = "  Brgy. San Roque  ",
            Notes = "  rush  ",
        };

        var created = Order.Create(ValidOrder(details), CallerId, Now);

        created.IsSuccess.ShouldBeTrue();
        var order = created.Value;
        order.CustomerName.ShouldBe("Juan Dela Cruz");
        order.TeamName.ShouldBe("Ballers");
        order.ContactNumber.ShouldBe("+63 (917) 123-4567");
        order.Email.ShouldBe("juan.dc@example.com");
        order.Address.ShouldBe("Brgy. San Roque");
        order.Notes.ShouldBe("rush");
        order.OrderDate.ShouldBe(OrderDay);
        order.DueDate.ShouldBe(OrderDay.AddDays(14));
        order.Number.ShouldBeEmpty();
        order.IsDeleted.ShouldBeFalse();
        order.DeletedAtUtc.ShouldBeNull();
        order.RowVersion.ShouldBeEmpty();
    }

    [Fact]
    public void EmptyOptionalTextBecomesNull()
    {
        var details = ValidDetails() with { TeamName = "  ", Email = "", Address = " ", Notes = "\t" };

        var order = Order.Create(ValidOrder(details), CallerId, Now).Value;

        order.TeamName.ShouldBeNull();
        order.Email.ShouldBeNull();
        order.Address.ShouldBeNull();
        order.Notes.ShouldBeNull();
    }

    [Fact]
    public void TheIdAndTheEditVersionAreVersionSevenIdsMadeFromTheClock()
    {
        var order = Order.Create(ValidOrder(), CallerId, Now).Value;

        order.Id.Version.ShouldBe(7);
        order.EditVersion.Version.ShouldBe(7);
        order.Items.ShouldAllBe(item => item.Id.Version == 7 && item.OrderId == order.Id);
        order.StatusChanges.ShouldAllBe(change => change.Id.Version == 7 && change.OrderId == order.Id);
    }

    [Fact]
    public void TheFirstHistoryRowGoesFromNothingToTheCreatedStatusByTheCallerAtTheSaveTime()
    {
        var order = Order.Create(ValidOrder(status: OrderStatus.Mockup), CallerId, Now).Value;

        var change = order.StatusChanges.ShouldHaveSingleItem();
        change.FromStatus.ShouldBeNull();
        change.ToStatus.ShouldBe(OrderStatus.Mockup);
        change.ChangedById.ShouldBe(CallerId);
        change.ChangedAtUtc.ShouldBe(Now);
        change.Order.ShouldBeSameAs(order);
        order.Status.ShouldBe(OrderStatus.Mockup);
        order.StatusChangedAtUtc.ShouldBe(Now);
    }

    [Fact]
    public void ItemsKeepTheirPlaceAndGetALineTotal()
    {
        var items = new[]
        {
            new NewOrderItem(ProductTypeId, "  Jersey top ", " S-XL ", 15, 650.00m),
            new NewOrderItem(ProductTypeId, "Banner", "  ", 1, 800.00m),
        };

        var order = Order.Create(new NewOrder(ValidDetails(), OrderStatus.Pending, items), CallerId, Now).Value;

        order.Items.Select(item => item.Position).ShouldBe([0, 1]);
        order.Items.Select(item => item.Description).ShouldBe(["Jersey top", "Banner"]);
        order.Items.Select(item => item.SizeVariant).ShouldBe(["S-XL", null]);
        order.Items.Select(item => item.LineTotal).ShouldBe([9750.00m, 800.00m]);
        order.Items.ShouldAllBe(item => item.Order == order && item.ProductTypeId == ProductTypeId);
    }

    [Fact]
    public void TheSnapshotEqualsWhatOrderMathGivesForTheItems()
    {
        var items = new[]
        {
            new NewOrderItem(ProductTypeId, "Jersey top", null, 15, 650.00m),
            new NewOrderItem(ProductTypeId, "Jersey shorts", null, 15, 300.00m),
            new NewOrderItem(ProductTypeId, "Polo", null, 2, 550.00m),
            new NewOrderItem(ProductTypeId, "Long sleeves", null, 15, 420.00m),
            new NewOrderItem(ProductTypeId, "Banner", null, 1, 800.00m),
        };

        var order = Order.Create(new NewOrder(ValidDetails(), OrderStatus.Pending, items), CallerId, Now).Value;

        var expected = OrderMath.Compute([.. items.Select(item => new OrderMathItem(item.Quantity, item.UnitPrice))], [], [], []);
        order.Totals.ShouldBe(new OrderTotals(22450.00m, 0.00m, 22450.00m, 0.00m, 0.00m, 22450.00m, 0.00m, 0.00m, 22450.00m, false));
        order.Subtotal.ShouldBe(expected.Subtotal);
        order.DiscountTotal.ShouldBe(expected.Discount);
        order.Total.ShouldBe(expected.Total);
        order.PaidTotal.ShouldBe(expected.Paid);
        order.RefundedTotal.ShouldBe(expected.Refunded);
        order.Balance.ShouldBe(expected.Balance);
        order.CustomerCredit.ShouldBe(expected.CustomerCredit);
        order.ExpensesTotal.ShouldBe(expected.Expenses);
        order.Profit.ShouldBe(expected.Profit);
        order.FullyPaid.ShouldBe(expected.FullyPaid);
    }

    [Fact]
    public void AFreeItemGivesAZeroSnapshotThatIsNotFullyPaid()
    {
        var items = new[] { new NewOrderItem(ProductTypeId, "Sample", null, 3, 0.00m) };

        var order = Order.Create(new NewOrder(ValidDetails(), OrderStatus.Pending, items), CallerId, Now).Value;

        order.Totals.Total.ShouldBe(0.00m);
        order.Totals.FullyPaid.ShouldBeFalse();
    }

    [Fact]
    public void AssignNumberSetsTheNumberOnceAndRefusesASecondAndABlankOne()
    {
        var order = Order.Create(ValidOrder(), CallerId, Now).Value;

        Should.Throw<ArgumentException>(() => order.AssignNumber(" "));
        order.AssignNumber("ORD-2026-0001");
        order.Number.ShouldBe("ORD-2026-0001");
        Should.Throw<InvalidOperationException>(() => order.AssignNumber("ORD-2026-0002"));
        order.Number.ShouldBe("ORD-2026-0001");
    }

    [Fact]
    public void ANullInputIsAProgrammingError()
    {
        Should.Throw<ArgumentNullException>(() => Order.Create(null!, CallerId, Now));
        Should.Throw<ArgumentNullException>(() => Order.Create(new NewOrder(ValidDetails(), OrderStatus.Pending, null!), CallerId, Now));
        Should.Throw<ArgumentNullException>(() => OrderRules.CheckDetails(null!));
        Should.Throw<ArgumentNullException>(() => OrderRules.CheckDetails(ValidDetails() with { CustomerName = null! }));
        Should.Throw<ArgumentNullException>(() => OrderRules.CheckItem(0, null!));
        Should.Throw<ArgumentNullException>(() => OrderRules.CheckItem(0, ValidItem() with { Description = null! }));
        Should.Throw<ArgumentNullException>(() => OrderRules.IsValidContactNumber(null!));
        Should.Throw<ArgumentNullException>(() => OrderRules.IsValidEmail(null!));
    }

    [Theory]
    [InlineData(OrderStatus.Pending)]
    [InlineData(OrderStatus.Mockup)]
    [InlineData(OrderStatus.InProduction)]
    [InlineData(OrderStatus.Ready)]
    [InlineData(OrderStatus.Delivered)]
    public void EveryActiveStatusIsAcceptedOnANewOrder(OrderStatus status) =>
        Order.Create(ValidOrder(status: status), CallerId, Now).Value.Status.ShouldBe(status);

    [Theory]
    [InlineData(OrderStatus.Completed)]
    [InlineData(OrderStatus.Cancelled)]
    public void CompletedAndCancelledAreRefusedOnANewOrder(OrderStatus status) =>
        Refused(ValidOrder(status: status), "status", "Create the order first, then complete or cancel it.");

    [Theory]
    [InlineData(0)]
    [InlineData(8)]
    [InlineData(255)]
    public void AStatusNumberThatIsNotOneOfTheSevenIsRefused(int status) =>
        Refused(ValidOrder(status: (OrderStatus)status), "status", "Choose a status.");

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void ABlankCustomerNameIsRefused(string name) =>
        Refused(ValidOrder(ValidDetails() with { CustomerName = name }), "customerName", "Enter the customer's name.");

    [Fact]
    public void ACustomerNameOfOneHundredCharactersIsAcceptedAndOneHundredAndOneIsRefused()
    {
        Order.Create(ValidOrder(ValidDetails() with { CustomerName = new string('a', 100) }), CallerId, Now).IsSuccess.ShouldBeTrue();
        Order.Create(ValidOrder(ValidDetails() with { CustomerName = "  " + new string('a', 100) + "  " }), CallerId, Now).IsSuccess.ShouldBeTrue();
        Refused(ValidOrder(ValidDetails() with { CustomerName = new string('a', 101) }), "customerName", "Keep the customer name to 100 characters or fewer.");
    }

    [Fact]
    public void ATeamNameOfOneHundredCharactersIsAcceptedAndOneHundredAndOneIsRefused()
    {
        Order.Create(ValidOrder(ValidDetails() with { TeamName = new string('t', 100) }), CallerId, Now).IsSuccess.ShouldBeTrue();
        Refused(ValidOrder(ValidDetails() with { TeamName = new string('t', 101) }), "teamName", "Keep the team name to 100 characters or fewer.");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void AMissingContactNumberIsRefused(string? contact) =>
        Refused(ValidOrder(ValidDetails() with { ContactNumber = contact }), "contactNumber", "Enter a contact number.");

    [Fact]
    public void AContactNumberOfThirtyCharactersIsAcceptedAndThirtyOneIsRefused()
    {
        Order.Create(ValidOrder(ValidDetails() with { ContactNumber = new string('1', 30) }), CallerId, Now).IsSuccess.ShouldBeTrue();
        Refused(ValidOrder(ValidDetails() with { ContactNumber = new string('1', 31) }), "contactNumber", "Keep the contact number to 30 characters or fewer.");
    }

    [Theory]
    [InlineData("0917-ABC")]
    [InlineData("0917.123.4567")]
    [InlineData("0917 123 4567 ext 2")]
    [InlineData("0917#1234")]
    public void AContactNumberWithOtherCharactersIsRefused(string contact) =>
        Refused(ValidOrder(ValidDetails() with { ContactNumber = contact }), "contactNumber", "Use digits, spaces and + - ( ) only.");

    [Theory]
    [InlineData("0917 123 4567")]
    [InlineData("+63 (917) 123-4567")]
    [InlineData("12345")]
    public void AContactNumberOfDigitsSpacesAndPlusDashParenthesesIsAccepted(string contact) =>
        Order.Create(ValidOrder(ValidDetails() with { ContactNumber = contact }), CallerId, Now).IsSuccess.ShouldBeTrue();

    [Fact]
    public void AnEmailOfTwoHundredAndFiftyFourCharactersIsAcceptedAndTwoHundredAndFiftyFiveIsRefused()
    {
        var longest = new string('a', 64) + "@" + new string('b', 63) + "." + new string('c', 63) + "." + new string('d', 57) + ".com";
        longest.Length.ShouldBe(254);

        Order.Create(ValidOrder(ValidDetails() with { Email = longest }), CallerId, Now).IsSuccess.ShouldBeTrue();
        Refused(ValidOrder(ValidDetails() with { Email = "e" + longest }), "email", "Keep the email to 254 characters or fewer.");
    }

    [Theory]
    [InlineData("juan@")]
    [InlineData("juan")]
    [InlineData("@example.com")]
    [InlineData("Juan <juan@example.com>")]
    [InlineData("juan@example")]
    [InlineData("ju an@example.com")]
    [InlineData("juan@@example.com")]
    public void ATextThatIsNotAnAddressIsRefused(string email) =>
        Refused(ValidOrder(ValidDetails() with { Email = email }), "email", "Enter a valid email address.");

    [Fact]
    public void AnAddressOfThreeHundredCharactersIsAcceptedAndThreeHundredAndOneIsRefused()
    {
        Order.Create(ValidOrder(ValidDetails() with { Address = new string('a', 300) }), CallerId, Now).IsSuccess.ShouldBeTrue();
        Refused(ValidOrder(ValidDetails() with { Address = new string('a', 301) }), "address", "Keep the address to 300 characters or fewer.");
    }

    [Fact]
    public void NotesOfTwoThousandCharactersAreAcceptedAndTwoThousandAndOneAreRefused()
    {
        Order.Create(ValidOrder(ValidDetails() with { Notes = new string('n', 2000) }), CallerId, Now).IsSuccess.ShouldBeTrue();
        Refused(ValidOrder(ValidDetails() with { Notes = new string('n', 2001) }), "notes", "Keep notes to 2,000 characters or fewer.");
    }

    [Fact]
    public void AMissingDueDateIsRefused() =>
        Refused(ValidOrder(ValidDetails() with { DueDate = null }), "dueDate", "Enter the due date.");

    [Fact]
    public void ADueDateEqualToTheOrderDateIsAcceptedAndOneDayBeforeIsRefused()
    {
        Order.Create(ValidOrder(ValidDetails() with { DueDate = OrderDay }), CallerId, Now).IsSuccess.ShouldBeTrue();
        Refused(ValidOrder(ValidDetails() with { DueDate = OrderDay.AddDays(-1) }), "dueDate", "The due date can't be before the order date.");
    }

    [Fact]
    public void NoItemsAreRefusedAndOneHundredItemsAreAcceptedAndOneHundredAndOneAreRefused()
    {
        Refused(new NewOrder(ValidDetails(), OrderStatus.Pending, []), "items", "Add at least one item.");
        Order.Create(new NewOrder(ValidDetails(), OrderStatus.Pending, Enumerable.Repeat(ValidItem(), 100).ToList()), CallerId, Now).Value.Items.Count.ShouldBe(100);
        Refused(new NewOrder(ValidDetails(), OrderStatus.Pending, Enumerable.Repeat(ValidItem(), 101).ToList()), "items", "An order can have at most 100 items.");
    }

    [Fact]
    public void AnEmptyProductTypeIsRefusedOnTheItemPath() =>
        Refused(Items(ValidItem(), ValidItem() with { ProductTypeId = Guid.Empty }), "items[1].productTypeId", "Choose a product type.");

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void ABlankDescriptionIsRefused(string description) =>
        Refused(Items(ValidItem() with { Description = description }), "items[0].description", "Describe the item.");

    [Fact]
    public void ADescriptionOfTwoHundredCharactersIsAcceptedAndTwoHundredAndOneIsRefused()
    {
        Order.Create(Items(ValidItem() with { Description = new string('d', 200) }), CallerId, Now).IsSuccess.ShouldBeTrue();
        Refused(Items(ValidItem() with { Description = new string('d', 201) }), "items[0].description", "Keep the description to 200 characters or fewer.");
    }

    [Fact]
    public void ASizeOrVariantOfOneHundredCharactersIsAcceptedAndOneHundredAndOneIsRefused()
    {
        Order.Create(Items(ValidItem() with { SizeVariant = new string('s', 100) }), CallerId, Now).IsSuccess.ShouldBeTrue();
        Refused(Items(ValidItem() with { SizeVariant = new string('s', 101) }), "items[0].sizeVariant", "Keep the size or variant to 100 characters or fewer.");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(10_001)]
    public void AQuantityOutsideOneToTenThousandIsRefused(int quantity) =>
        Refused(Items(ValidItem() with { Quantity = quantity }), "items[0].quantity", "Enter a quantity from 1 to 10,000.");

    [Theory]
    [InlineData(1)]
    [InlineData(10_000)]
    public void AQuantityOfOneAndTenThousandIsAccepted(int quantity) =>
        Order.Create(Items(ValidItem() with { Quantity = quantity, UnitPrice = 1.00m }), CallerId, Now).Value.Items.Single().Quantity.ShouldBe(quantity);

    [Theory]
    [InlineData("-0.01")]
    [InlineData("1000000.01")]
    public void AUnitPriceOutsideZeroToOneMillionIsRefused(string price) =>
        Refused(Items(ValidItem() with { UnitPrice = decimal.Parse(price, System.Globalization.CultureInfo.InvariantCulture) }), "items[0].unitPrice", "Enter a unit price from ₱0.00 to ₱1,000,000.00.");

    [Theory]
    [InlineData("0.00")]
    [InlineData("0.01")]
    [InlineData("1000000.00")]
    public void AUnitPriceOfZeroAndOneMillionIsAccepted(string price)
    {
        var unitPrice = decimal.Parse(price, System.Globalization.CultureInfo.InvariantCulture);

        Order.Create(Items(ValidItem() with { Quantity = 1, UnitPrice = unitPrice }), CallerId, Now).Value.Items.Single().UnitPrice.ShouldBe(unitPrice);
    }

    [Fact]
    public void AUnitPriceWithMoreThanTwoDecimalPlacesIsRefused() =>
        Refused(Items(ValidItem() with { UnitPrice = 650.123m }), "items[0].unitPrice", "Use at most 2 decimal places.");

    [Fact]
    public void TheFirstBrokenFieldIsTheOneReported()
    {
        var order = new NewOrder(
            ValidDetails() with { CustomerName = "", ContactNumber = null },
            OrderStatus.Completed,
            [ValidItem() with { Quantity = 0 }]);

        var failure = Order.Create(order, CallerId, Now);

        failure.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["customerName"]);
        failure.Error.Code.ShouldBe("orders.invalid-request");
        failure.Error.Message.ShouldBe("Check the highlighted fields.");
        failure.Error.Kind.ShouldBe(ErrorKind.Validation);
    }

    [Fact]
    public void AnItemBrokenInTheSecondPlaceNamesTheSecondPath() =>
        Refused(Items(ValidItem(), ValidItem(), ValidItem() with { Quantity = 0 }), "items[2].quantity", "Enter a quantity from 1 to 10,000.");

    [Fact]
    public void TheRulesHelpersAgreeWithTheirDefinitions()
    {
        OrderRules.ItemPath(3, OrderRules.UnitPriceField).ShouldBe("items[3].unitPrice");
        OrderRules.HasValidScale(1.25m).ShouldBeTrue();
        OrderRules.HasValidScale(1.255m).ShouldBeFalse();
        OrderRules.UnitPriceMax.ShouldBe(1_000_000.00m);
        OrderRules.IsValidContactNumber("0917 123").ShouldBeTrue();
        OrderRules.IsValidContactNumber("0917x").ShouldBeFalse();
        OrderRules.IsValidEmail("a@b.co").ShouldBeTrue();
        OrderRules.IsValidEmail("a@b").ShouldBeFalse();
    }

    private static void Refused(NewOrder input, string field, string message)
    {
        var result = Order.Create(input, CallerId, Now);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        var fields = result.Error.FieldErrors.ShouldNotBeNull();
        fields.Keys.ShouldBe([field]);
        fields[field].ShouldBe([message]);
    }

    private static OrderDetails ValidDetails() => new(
        "Juan Dela Cruz",
        "Brgy. San Roque Ballers",
        "0917 123 4567",
        "juan.dc@example.com",
        null,
        OrderDay,
        OrderDay.AddDays(14),
        null);

    private static NewOrderItem ValidItem() => new(ProductTypeId, "Jersey top", "S-XL", 15, 650.00m);

    private static NewOrder ValidOrder(OrderDetails? details = null, OrderStatus status = OrderStatus.Pending) =>
        new(details ?? ValidDetails(), status, [ValidItem()]);

    private static NewOrder Items(params NewOrderItem[] items) => new(ValidDetails(), OrderStatus.Pending, items);
}
