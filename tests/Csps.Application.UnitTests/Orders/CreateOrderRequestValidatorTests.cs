using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Orders;
using FluentValidation.Results;

namespace Csps.Application.UnitTests.Orders;

/// <summary>ORD-03, ORD-13, D-21, D-22, D-30, OR-3: every static order rule and its plain-English message, at its boundary.</summary>
public sealed class CreateOrderRequestValidatorTests
{
    private static readonly Guid ProductTypeId = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly CreateOrderRequestValidator Validator = new();

    [Fact]
    public void ABoundaryValidFormHasNoErrors() => Fields(Valid()).ShouldBeEmpty();

    [Fact]
    public void AnEmptyFormListsEveryRequiredField() =>
        Fields(CreateOrderRequest.Empty).Keys.Order(StringComparer.Ordinal).ShouldBe(["contactNumber", "customerName", "dueDate", "items", "orderDate"]);

    [Theory]
    [InlineData(null, "Enter the customer's name.")]
    [InlineData("", "Enter the customer's name.")]
    [InlineData("   ", "Enter the customer's name.")]
    public void AMissingCustomerNameIsRefused(string? name, string message) => One(Valid() with { CustomerName = name }, "customerName", message);

    [Fact]
    public void ACustomerNameIsLimitedToOneHundredCharactersAfterTrimming()
    {
        Fields(Valid() with { CustomerName = "  " + new string('a', 100) + "  " }).ShouldBeEmpty();
        One(Valid() with { CustomerName = new string('a', 101) }, "customerName", "Keep the customer name to 100 characters or fewer.");
    }

    [Fact]
    public void ATeamNameIsLimitedToOneHundredCharacters()
    {
        Fields(Valid() with { TeamName = new string('t', 100) }).ShouldBeEmpty();
        One(Valid() with { TeamName = new string('t', 101) }, "teamName", "Keep the team name to 100 characters or fewer.");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void AMissingContactNumberIsRefused(string? contact) =>
        One(Valid() with { ContactNumber = contact }, "contactNumber", "Enter a contact number.");

    [Fact]
    public void AContactNumberIsLimitedToThirtyCharacters()
    {
        Fields(Valid() with { ContactNumber = new string('1', 30) }).ShouldBeEmpty();
        One(Valid() with { ContactNumber = new string('1', 31) }, "contactNumber", "Keep the contact number to 30 characters or fewer.");
    }

    [Theory]
    [InlineData("0917-ABC")]
    [InlineData("0917.123")]
    public void AContactNumberWithOtherCharactersIsRefused(string contact) =>
        One(Valid() with { ContactNumber = contact }, "contactNumber", "Use digits, spaces and + - ( ) only.");

    [Fact]
    public void AContactNumberOfDigitsSpacesAndPlusDashParenthesesIsAccepted() =>
        Fields(Valid() with { ContactNumber = "+63 (917) 123-4567" }).ShouldBeEmpty();

    [Theory]
    [InlineData("juan@")]
    [InlineData("juan")]
    [InlineData("juan@example")]
    [InlineData("Juan <juan@example.com>")]
    public void AnEmailThatIsNotAnAddressIsRefused(string email) =>
        One(Valid() with { Email = email }, "email", "Enter a valid email address.");

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void AnEmptyEmailIsAccepted(string? email) => Fields(Valid() with { Email = email }).ShouldBeEmpty();

    [Fact]
    public void AnEmailIsLimitedToTwoHundredAndFiftyFourCharacters()
    {
        var longest = new string('a', 64) + "@" + new string('b', 63) + "." + new string('c', 63) + "." + new string('d', 57) + ".com";

        Fields(Valid() with { Email = longest }).ShouldBeEmpty();
        One(Valid() with { Email = "e" + longest }, "email", "Keep the email to 254 characters or fewer.");
    }

    [Fact]
    public void AnAddressIsLimitedToThreeHundredCharacters()
    {
        Fields(Valid() with { Address = new string('a', 300) }).ShouldBeEmpty();
        One(Valid() with { Address = new string('a', 301) }, "address", "Keep the address to 300 characters or fewer.");
    }

    [Fact]
    public void NotesAreLimitedToTwoThousandCharacters()
    {
        Fields(Valid() with { Notes = new string('n', 2000) }).ShouldBeEmpty();
        One(Valid() with { Notes = new string('n', 2001) }, "notes", "Keep notes to 2,000 characters or fewer.");
    }

    [Theory]
    [InlineData(null, "Enter the order date.")]
    [InlineData("", "Enter the order date.")]
    [InlineData("2026-02-30", "Enter a real date.")]
    [InlineData("28/10/2026", "Enter a real date.")]
    [InlineData("2026-10-28T00:00:00", "Enter a real date.")]
    [InlineData("not a date", "Enter a real date.")]
    public void AnOrderDateThatIsNotARealIsoDateIsRefused(string? date, string message) =>
        One(Valid() with { OrderDate = date }, "orderDate", message);

    [Theory]
    [InlineData(null, "Enter the due date.")]
    [InlineData(" ", "Enter the due date.")]
    [InlineData("2026-02-30", "Enter a real date.")]
    [InlineData("11-12-2026", "Enter a real date.")]
    public void ADueDateThatIsMissingOrNotARealIsoDateIsRefused(string? date, string message) =>
        One(Valid() with { DueDate = date }, "dueDate", message);

    [Fact]
    public void ADueDateEqualToTheOrderDateIsAcceptedAndOneDayBeforeIsRefused()
    {
        Fields(Valid() with { OrderDate = "2026-10-28", DueDate = "2026-10-28" }).ShouldBeEmpty();
        One(Valid() with { OrderDate = "2026-10-28", DueDate = "2026-10-27" }, "dueDate", "The due date can't be before the order date.");
    }

    [Fact]
    public void ADueDateIsNotComparedWhenTheOrderDateIsNotADate() =>
        One(Valid() with { OrderDate = "nope", DueDate = "2026-10-27" }, "orderDate", "Enter a real date.");

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("pending")]
    [InlineData("MOCKUP")]
    [InlineData(" production ")]
    [InlineData("ready")]
    [InlineData("delivered")]
    public void AnActiveStatusOrNoStatusIsAccepted(string? status) => Fields(Valid() with { Status = status }).ShouldBeEmpty();

    [Theory]
    [InlineData("completed")]
    [InlineData("Cancelled")]
    public void CompletedAndCancelledAreRefusedOnANewOrder(string status) =>
        One(Valid() with { Status = status }, "status", "Create the order first, then complete or cancel it.");

    [Theory]
    [InlineData("done")]
    [InlineData("in production")]
    [InlineData("1")]
    public void AStatusNameThatIsNotOneOfTheSevenIsRefused(string status) =>
        One(Valid() with { Status = status }, "status", "Choose a status.");

    [Fact]
    public void NoItemsAndANullListAreRefused()
    {
        One(Valid() with { Items = [] }, "items", "Add at least one item.");
        One(Valid() with { Items = null }, "items", "Add at least one item.");
    }

    [Fact]
    public void OneHundredItemsAreAcceptedAndOneHundredAndOneAreRefused()
    {
        Fields(Valid() with { Items = [.. Enumerable.Repeat(Item(), 100)] }).ShouldBeEmpty();
        One(Valid() with { Items = [.. Enumerable.Repeat(Item(), 101)] }, "items", "An order can have at most 100 items.");
    }

    [Fact]
    public void ANullItemInTheListIsRefusedOnItsPath() =>
        One(Valid() with { Items = [Item(), null!] }, "items[1]", "Fill in this item.");

    [Fact]
    public void AMissingOrEmptyProductTypeIsRefusedOnTheItemPath()
    {
        One(Valid() with { Items = [Item() with { ProductTypeId = null }] }, "items[0].productTypeId", "Choose a product type.");
        One(Valid() with { Items = [Item(), Item() with { ProductTypeId = Guid.Empty }] }, "items[1].productTypeId", "Choose a product type.");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void AMissingDescriptionIsRefused(string? description) =>
        One(Valid() with { Items = [Item() with { Description = description }] }, "items[0].description", "Describe the item.");

    [Fact]
    public void ADescriptionIsLimitedToTwoHundredCharacters()
    {
        Fields(Valid() with { Items = [Item() with { Description = new string('d', 200) }] }).ShouldBeEmpty();
        One(Valid() with { Items = [Item() with { Description = new string('d', 201) }] }, "items[0].description", "Keep the description to 200 characters or fewer.");
    }

    [Fact]
    public void ASizeOrVariantIsLimitedToOneHundredCharacters()
    {
        Fields(Valid() with { Items = [Item() with { SizeVariant = new string('s', 100) }] }).ShouldBeEmpty();
        Fields(Valid() with { Items = [Item() with { SizeVariant = null }] }).ShouldBeEmpty();
        One(Valid() with { Items = [Item() with { SizeVariant = new string('s', 101) }] }, "items[0].sizeVariant", "Keep the size or variant to 100 characters or fewer.");
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(10_001)]
    public void AQuantityOutsideOneToTenThousandIsRefused(int? quantity) =>
        One(Valid() with { Items = [Item(), Item() with { Quantity = quantity }] }, "items[1].quantity", "Enter a quantity from 1 to 10,000.");

    [Theory]
    [InlineData(1)]
    [InlineData(10_000)]
    public void AQuantityOfOneAndTenThousandIsAccepted(int quantity) =>
        Fields(Valid() with { Items = [Item() with { Quantity = quantity }] }).ShouldBeEmpty();

    [Fact]
    public void AMissingUnitPriceIsRefused() =>
        One(Valid() with { Items = [Item() with { UnitPrice = null }] }, "items[0].unitPrice", "Enter a unit price.");

    [Theory]
    [InlineData("-0.01")]
    [InlineData("1000000.01")]
    public void AUnitPriceOutsideZeroToOneMillionIsRefused(string price) =>
        One(Valid() with { Items = [Item() with { UnitPrice = Parse(price) }] }, "items[0].unitPrice", "Enter a unit price from ₱0.00 to ₱1,000,000.00.");

    [Theory]
    [InlineData("0.00")]
    [InlineData("0.01")]
    [InlineData("650")]
    [InlineData("1000000.00")]
    public void AUnitPriceOfZeroAndOneMillionIsAccepted(string price) =>
        Fields(Valid() with { Items = [Item() with { UnitPrice = Parse(price) }] }).ShouldBeEmpty();

    [Fact]
    public void AUnitPriceWithMoreThanTwoDecimalPlacesIsRefused() =>
        One(Valid() with { Items = [Item() with { UnitPrice = 650.123m }] }, "items[0].unitPrice", "Use at most 2 decimal places.");

    [Fact]
    public void ManyBrokenFieldsComeBackTogetherWithTheirPaths()
    {
        var request = Valid() with
        {
            CustomerName = "",
            Email = "juan@",
            Items = [Item() with { Quantity = 0 }, Item() with { UnitPrice = 650.123m, Description = " " }],
        };

        Fields(request).Keys.Order(StringComparer.Ordinal).ShouldBe(["customerName", "email", "items[0].quantity", "items[1].description", "items[1].unitPrice"]);
    }

    [Fact]
    public void TheDetailsAndItemValidatorsWorkOnTheirOwnInterfaces()
    {
        var details = new OrderDetailsFieldsValidator().Validate(Valid());
        var item = new OrderItemFieldsValidator().Validate(Item() with { Quantity = 0 });

        details.IsValid.ShouldBeTrue();
        item.Errors.Select(error => error.PropertyName).ShouldBe(["Quantity"]);
    }

    [Theory]
    [InlineData("2026-10-28", true, 2026, 10, 28)]
    [InlineData("  2026-10-28  ", true, 2026, 10, 28)]
    [InlineData("2026-02-30", false, 1, 1, 1)]
    [InlineData("", false, 1, 1, 1)]
    [InlineData(null, false, 1, 1, 1)]
    public void ADateIsReadOnlyInTheIsoForm(string? text, bool parsed, int year, int month, int day)
    {
        OrderDetailsFieldsValidator.TryParseDate(text, out var date).ShouldBe(parsed);

        date.ShouldBe(new DateOnly(year, month, day));
    }

    private static CreateOrderRequest Valid() => new(
        "Juan Dela Cruz",
        "Brgy. San Roque Ballers",
        "0917 123 4567",
        "juan.dc@example.com",
        null,
        "2026-10-28",
        "2026-11-11",
        null,
        null,
        [Item()]);

    private static OrderItemRequest Item() => new(ProductTypeId, "Jersey top", "S-XL", 15, 650.00m);

    private static decimal Parse(string text) => decimal.Parse(text, CultureInfo.InvariantCulture);

    private static Dictionary<string, string[]> Fields(CreateOrderRequest request)
    {
        ValidationResult result = Validator.Validate(request);
        return result.IsValid
            ? []
            : ValidationResults.ToError(result, "orders.invalid-request", "Check the highlighted fields.").FieldErrors.ShouldNotBeNull()
                .ToDictionary(pair => pair.Key, pair => pair.Value);
    }

    private static void One(CreateOrderRequest request, string field, string message)
    {
        var fields = Fields(request);
        fields.Keys.ShouldBe([field]);
        fields[field].ShouldBe([message]);
    }
}
