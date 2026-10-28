using Csps.Application.Orders;

namespace Csps.Application.UnitTests.Orders;

/// <summary>ORD-02, SEC-03, WEB-10, OR-3: every cap and message of the order list query, at its edge.</summary>
public sealed class ListOrdersRequestValidatorTests
{
    private readonly ListOrdersRequestValidator _validator = new();

    [Fact]
    public void AnEmptyQueryIsAcceptedAndTheDefaultsAreActiveDueFirstPageOfTwenty()
    {
        var request = new ListOrdersRequest();

        _validator.Validate(request).IsValid.ShouldBeTrue();
        request.Status.ShouldBeNull();
        request.Sort.ShouldBeNull();
        request.Page.ShouldBe(1);
        request.PageSize.ShouldBe(20);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("active")]
    [InlineData("ALL")]
    [InlineData(" Delivered ")]
    [InlineData("pending")]
    [InlineData("mockup")]
    [InlineData("production")]
    [InlineData("ready")]
    [InlineData("completed")]
    [InlineData("cancelled")]
    public void ActiveAllAndTheSevenStatusKeysAreAccepted(string? status)
    {
        _validator.Validate(new ListOrdersRequest(Status: status)).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData("shipped")]
    [InlineData("in production")]
    [InlineData("7")]
    public void AnUnknownStatusIsRefused(string status)
    {
        var error = _validator.Validate(new ListOrdersRequest(Status: status)).Errors.ShouldHaveSingleItem();

        error.PropertyName.ShouldBe("Status");
        error.ErrorMessage.ShouldBe("Choose a status.");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("due")]
    [InlineData("Newest")]
    [InlineData("balance")]
    [InlineData("TOTAL")]
    public void TheFourSortsAreAccepted(string? sort)
    {
        _validator.Validate(new ListOrdersRequest(Sort: sort)).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData("price")]
    [InlineData("due desc")]
    public void AnUnknownSortIsRefused(string sort)
    {
        var error = _validator.Validate(new ListOrdersRequest(Sort: sort)).Errors.ShouldHaveSingleItem();

        error.PropertyName.ShouldBe("Sort");
        error.ErrorMessage.ShouldBe("Choose a sort order.");
    }

    [Theory]
    [InlineData("2026-10-28", null)]
    [InlineData(null, "2026-10-28")]
    [InlineData("2026-10-01", "2026-10-31")]
    [InlineData("2026-10-28", "2026-10-28")]
    [InlineData(" 2026-02-28 ", " 2026-03-01 ")]
    public void RealDatesInOrderAreAcceptedAloneOrAsAPair(string? from, string? to)
    {
        _validator.Validate(new ListOrdersRequest(From: from, To: to)).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData("2026-13-01")]
    [InlineData("2026-02-30")]
    [InlineData("10/28/2026")]
    [InlineData("tomorrow")]
    public void AFromThatIsNotARealDayIsRefused(string from)
    {
        var error = _validator.Validate(new ListOrdersRequest(From: from)).Errors.ShouldHaveSingleItem();

        error.PropertyName.ShouldBe("From");
        error.ErrorMessage.ShouldBe("Enter a real date.");
    }

    [Fact]
    public void AToThatIsNotARealDayIsRefused()
    {
        var error = _validator.Validate(new ListOrdersRequest(To: "2026-00-10")).Errors.ShouldHaveSingleItem();

        error.PropertyName.ShouldBe("To");
        error.ErrorMessage.ShouldBe("Enter a real date.");
    }

    [Fact]
    public void AToBeforeTheFromIsRefusedOnTo()
    {
        var error = _validator.Validate(new ListOrdersRequest(From: "2026-10-28", To: "2026-10-27")).Errors.ShouldHaveSingleItem();

        error.PropertyName.ShouldBe("To");
        error.ErrorMessage.ShouldBe("The end date can't be before the start date.");
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(100_000, 100)]
    public void TheEdgesOfThePageAndSizeRangesAreAccepted(int page, int pageSize)
    {
        _validator.Validate(new ListOrdersRequest(Page: page, PageSize: pageSize)).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData(0, 20, "Page", "Use a page from 1 to 100000.")]
    [InlineData(100_001, 20, "Page", "Use a page from 1 to 100000.")]
    [InlineData(1, 0, "PageSize", "Use a page size from 1 to 100.")]
    [InlineData(1, 101, "PageSize", "Use a page size from 1 to 100.")]
    public void APageOrSizeOutsideItsRangeIsRefused(int page, int pageSize, string field, string message)
    {
        var error = _validator.Validate(new ListOrdersRequest(Page: page, PageSize: pageSize)).Errors.ShouldHaveSingleItem();

        error.PropertyName.ShouldBe(field);
        error.ErrorMessage.ShouldBe(message);
    }

    [Fact]
    public void ASearchOfOneHundredCharactersPassesAndOneHundredAndOneIsRefused()
    {
        _validator.Validate(new ListOrdersRequest(Q: new string('a', 100))).IsValid.ShouldBeTrue();

        var error = _validator.Validate(new ListOrdersRequest(Q: new string('a', 101))).Errors.ShouldHaveSingleItem();

        error.PropertyName.ShouldBe("Q");
        error.ErrorMessage.ShouldBe("Use 100 characters or fewer.");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("447ad32e-1433-4b70-8786-72e3dc3f9937")]
    [InlineData(" 447AD32E-1433-4B70-8786-72E3DC3F9937 ")]
    public void ABlankOrDashedProductTypeIdIsAccepted(string? productType)
    {
        _validator.Validate(new ListOrdersRequest(ProductType: productType)).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData("polo")]
    [InlineData("447ad32e14334b70878672e3dc3f9937")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    public void AnythingElseAsAProductTypeIsRefused(string productType)
    {
        var error = _validator.Validate(new ListOrdersRequest(ProductType: productType)).Errors.ShouldHaveSingleItem();

        error.PropertyName.ShouldBe("ProductType");
        error.ErrorMessage.ShouldBe("Choose a product type.");
    }

    [Fact]
    public void SeveralBadPartsAreAllReported()
    {
        var result = _validator.Validate(new ListOrdersRequest(Status: "shipped", Sort: "price", From: "x", PageSize: 0));

        result.Errors.Select(error => error.PropertyName).Order(StringComparer.Ordinal).ShouldBe(["From", "PageSize", "Sort", "Status"]);
    }
}
