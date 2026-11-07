using Csps.Application.Dashboard;

namespace Csps.Application.UnitTests.Dashboard;

/// <summary>CWE-20, T-10-09: the chart accepts only 6 or 12 months, or none.</summary>
public sealed class GetDashboardChartRequestValidatorTests
{
    private readonly GetDashboardChartRequestValidator _validator = new();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("6")]
    [InlineData("12")]
    [InlineData(" 12 ")]
    public void NoMonthsSixAndTwelveAreAccepted(string? months)
    {
        _validator.Validate(new GetDashboardChartRequest(months)).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData("7")]
    [InlineData("0")]
    [InlineData("-6")]
    [InlineData("1000")]
    [InlineData("abc")]
    [InlineData("6.5")]
    [InlineData("+6")]
    [InlineData("99999999999999999999")]
    public void AnythingElseIsRefusedWithThePlainMessageOnMonths(string months)
    {
        var result = _validator.Validate(new GetDashboardChartRequest(months));

        result.IsValid.ShouldBeFalse();
        var failure = result.Errors.ShouldHaveSingleItem();
        failure.PropertyName.ShouldBe("Months");
        failure.ErrorMessage.ShouldBe("Choose 6 or 12 months.");
    }

    [Fact]
    public void TheAllowListIsSixAndTwelveWithSixTheDefault()
    {
        GetDashboardChartRequest.AllowedMonths.ShouldBe([6, 12]);
        GetDashboardChartRequest.DefaultMonths.ShouldBe(6);
    }
}
