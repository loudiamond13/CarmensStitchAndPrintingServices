using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Domain.Orders;

namespace Csps.Application.UnitTests.Orders;

/// <summary>ORD-04, D-12 to D-15, OR-3: the photo move and description forms name the field that is wrong, in plain English.</summary>
public sealed class OrderImageRequestValidatorTests
{
    private static readonly string Version = RowVersions.ToText([1, 2, 3, 4, 5, 6, 7, 8]);

    private readonly MoveOrderImageRequestValidator _move = new();
    private readonly DescribeOrderImageRequestValidator _describe = new();

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(4)]
    public void APlaceFromZeroToFourWithAVersionIsAccepted(int place)
    {
        _move.Validate(new MoveOrderImageRequest(place, Version)).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData(null)]
    [InlineData(-1)]
    [InlineData(5)]
    [InlineData(int.MaxValue)]
    public void AMissingNegativeOrTooHighPlaceIsRefusedOnThePositionField(int? place)
    {
        var error = _move.Validate(new MoveOrderImageRequest(place, Version)).Errors.ShouldHaveSingleItem();

        error.PropertyName.ShouldBe("Position");
        error.ErrorMessage.ShouldBe(OrderImageRules.PositionOutOfRangeMessage);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not base64!")]
    [InlineData("AQID")]
    public void AMissingOrMalformedVersionIsRefusedOnTheVersionField(string? version)
    {
        var error = _move.Validate(new MoveOrderImageRequest(0, version)).Errors.ShouldHaveSingleItem();

        error.PropertyName.ShouldBe("Version");
        error.ErrorMessage.ShouldBe(RowVersions.InvalidMessage);
    }

    [Fact]
    public void AnEmptyBodyReportsBothFields()
    {
        var failed = _move.Validate(MoveOrderImageRequest.Empty).Errors.Select(error => error.PropertyName).Order().ToArray();

        failed.ShouldBe(["Position", "Version"]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Front mockup")]
    public void AnyShortDescriptionOrNoneWithAVersionIsAccepted(string? description)
    {
        _describe.Validate(new DescribeOrderImageRequest(description, Version)).IsValid.ShouldBeTrue();
    }

    [Fact]
    public void ADescriptionOfTwoHundredCharactersAfterTrimmingIsAcceptedAndTwoHundredAndOneIsRefused()
    {
        _describe.Validate(new DescribeOrderImageRequest($"  {new string('a', 200)}  ", Version)).IsValid.ShouldBeTrue();

        var error = _describe.Validate(new DescribeOrderImageRequest(new string('a', 201), Version)).Errors.ShouldHaveSingleItem();

        error.PropertyName.ShouldBe("Description");
        error.ErrorMessage.ShouldBe("Keep the description to 200 characters or fewer.");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not base64!")]
    public void ADescriptionWithAMissingOrMalformedVersionIsRefusedOnTheVersionField(string? version)
    {
        var error = _describe.Validate(new DescribeOrderImageRequest("Front", version)).Errors.ShouldHaveSingleItem();

        error.PropertyName.ShouldBe("Version");
        error.ErrorMessage.ShouldBe(RowVersions.InvalidMessage);
    }

    [Fact]
    public void AnEmptyDescriptionBodyReportsOnlyTheVersion()
    {
        _describe.Validate(DescribeOrderImageRequest.Empty).Errors.Select(error => error.PropertyName).ShouldBe(["Version"]);
    }
}
