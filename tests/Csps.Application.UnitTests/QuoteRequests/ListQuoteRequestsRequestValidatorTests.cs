using Csps.Application.QuoteRequests;

namespace Csps.Application.UnitTests.QuoteRequests;

/// <summary>INQ-05, D-18, SEC-03, WEB-10: every cap and message of the staff inbox query, at its edge, and the phone digits of a search.</summary>
public sealed class ListQuoteRequestsRequestValidatorTests
{
    private readonly ListQuoteRequestsRequestValidator _validator = new();

    [Fact]
    public void AnEmptyQueryIsAcceptedAndTheDefaultsAreOpenFirstPageOfTwenty()
    {
        var request = new ListQuoteRequestsRequest();

        _validator.Validate(request).IsValid.ShouldBeTrue();
        request.Status.ShouldBeNull();
        request.Page.ShouldBe(1);
        request.Size.ShouldBe(20);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("open")]
    [InlineData("OPEN")]
    [InlineData(" converted ")]
    [InlineData("closed")]
    [InlineData("spam")]
    [InlineData("all")]
    public void TheFiveGroupsAreAccepted(string? status)
    {
        _validator.Validate(new ListQuoteRequestsRequest(Status: status)).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData("pending")]
    [InlineData("new")]
    [InlineData("quoted")]
    [InlineData("7")]
    public void AnythingElseIsRefused(string status)
    {
        var error = _validator.Validate(new ListQuoteRequestsRequest(Status: status)).Errors.ShouldHaveSingleItem();

        error.PropertyName.ShouldBe("Status");
        error.ErrorMessage.ShouldBe("Choose a status.");
    }

    [Theory]
    [InlineData(10)]
    [InlineData(20)]
    [InlineData(50)]
    [InlineData(100)]
    public void TheFourPageSizesAreAccepted(int size)
    {
        _validator.Validate(new ListQuoteRequestsRequest(Size: size)).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(15)]
    [InlineData(101)]
    [InlineData(-10)]
    public void AnyOtherPageSizeIsRefused(int size)
    {
        var error = _validator.Validate(new ListQuoteRequestsRequest(Size: size)).Errors.ShouldHaveSingleItem();

        error.PropertyName.ShouldBe("Size");
        error.ErrorMessage.ShouldBe("Use a page size of 10, 20, 50 or 100.");
    }

    [Theory]
    [InlineData(1, true)]
    [InlineData(100000, true)]
    [InlineData(0, false)]
    [InlineData(100001, false)]
    public void ThePageIsFromOneTo100000(int page, bool valid)
    {
        var result = _validator.Validate(new ListQuoteRequestsRequest(Page: page));

        result.IsValid.ShouldBe(valid);
        if (!valid)
        {
            result.Errors.ShouldHaveSingleItem().ErrorMessage.ShouldBe("Use a page from 1 to 100000.");
        }
    }

    [Fact]
    public void ASearchOf100CharactersIsAcceptedAndOneMoreIsRefused()
    {
        _validator.Validate(new ListQuoteRequestsRequest(Q: new string('a', 100))).IsValid.ShouldBeTrue();

        var error = _validator.Validate(new ListQuoteRequestsRequest(Q: new string('a', 101))).Errors.ShouldHaveSingleItem();

        error.PropertyName.ShouldBe("Q");
        error.ErrorMessage.ShouldBe("Use 100 characters or fewer.");
    }

    [Fact]
    public void TheSearchIsCountedAfterTrimming()
    {
        _validator.Validate(new ListQuoteRequestsRequest(Q: "  " + new string('a', 100) + "  ")).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData("0917 123", "917123")]
    [InlineData("917123", "917123")]
    [InlineData("+63 917 123 4567", "9171234567")]
    [InlineData("63917123", "917123")]
    [InlineData("0917", "917")]
    [InlineData("0917-123-4567", "9171234567")]
    [InlineData("09171", "9171")]
    [InlineData("+639171", "9171")]
    [InlineData("639171", "9171")]
    public void PhoneDigitsDropALeadingZeroOr63(string text, string expected)
    {
        QuoteRequestSearchText.PhoneDigits(text).ShouldBe(expected);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("juan")]
    [InlineData("Juan 2")]
    [InlineData("09")]
    [InlineData("12")]
    [InlineData("0")]
    [InlineData("63")]
    [InlineData("091")]
    [InlineData("0 9")]
    [InlineData("639")]
    [InlineData("+639")]
    [InlineData("+63 91")]
    public void FewerThanThreeDigitsIsNoPhoneSearch(string? text)
    {
        QuoteRequestSearchText.PhoneDigits(text).ShouldBeNull();
    }
}
