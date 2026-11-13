using Csps.Application.Orders;
using Csps.Domain.Orders;

namespace Csps.Application.UnitTests.Orders;

/// <summary>D-11, D-13, OR-3: the one public website rule set shared by the order window, the New Order form and the Edit Order form says the same words for each.</summary>
public sealed class OrderPublicWebsiteFieldsValidatorTests
{
    private readonly OrderPublicWebsiteFieldsValidator _validator = new();

    [Theory]
    [InlineData(false, false, null)]
    [InlineData(true, false, null)]
    [InlineData(true, true, null)]
    [InlineData(true, true, "")]
    [InlineData(true, true, "Tondo Riders MC")]
    public void ValidSettingsPass(bool consent, bool show, string? name) =>
        _validator.Validate(new OrderPublicWebsiteFields(consent, show, null, name)).IsValid.ShouldBeTrue();

    [Fact]
    public void ShowingWithoutTheOkIsRefusedOnTheShowFlagWithTheExactMessage()
    {
        var result = _validator.Validate(new OrderPublicWebsiteFields(false, true, null, null));

        var failure = result.Errors.ShouldHaveSingleItem();
        failure.PropertyName.ShouldBe(nameof(IOrderPublicWebsiteFields.ShowOnWebsite));
        failure.ErrorMessage.ShouldBe("Tick Customer said OK to show first.");
        failure.ErrorMessage.ShouldBe(OrderPublicSettings.ConsentRequiredMessage);
    }

    [Fact]
    public void ANameOfEightyCharactersPassesAndOneMoreIsRefusedWithTheExactMessage()
    {
        _validator.Validate(new OrderPublicWebsiteFields(true, false, null, new string('n', 80))).IsValid.ShouldBeTrue();

        var result = _validator.Validate(new OrderPublicWebsiteFields(true, false, null, new string('n', 81)));

        var failure = result.Errors.ShouldHaveSingleItem();
        failure.PropertyName.ShouldBe(nameof(IOrderPublicWebsiteFields.PublicName));
        failure.ErrorMessage.ShouldBe("Keep the name to 80 characters or fewer.");
    }

    [Fact]
    public void TheNameIsCountedAfterTrimming() =>
        _validator.Validate(new OrderPublicWebsiteFields(true, false, null, "  " + new string('n', 80) + "  ")).IsValid.ShouldBeTrue();

    [Fact]
    public void BothRulesAreReportedTogether()
    {
        var result = _validator.Validate(new OrderPublicWebsiteFields(false, true, null, new string('n', 81)));

        result.Errors.Select(failure => failure.PropertyName).Order(StringComparer.Ordinal).ShouldBe(["PublicName", "ShowOnWebsite"]);
    }

    [Fact]
    public void ABlockThatSetsNothingSaysSoAndAnyOneSettingMakesItNot()
    {
        new OrderPublicWebsiteFields(false, false, null, null).SetsNothing().ShouldBeTrue();
        new OrderPublicWebsiteFields(false, false, null, "   ").SetsNothing().ShouldBeTrue();
        new OrderPublicWebsiteFields(true, false, null, null).SetsNothing().ShouldBeFalse();
        new OrderPublicWebsiteFields(false, true, null, null).SetsNothing().ShouldBeFalse();
        new OrderPublicWebsiteFields(false, false, Guid.NewGuid(), null).SetsNothing().ShouldBeFalse();
        new OrderPublicWebsiteFields(false, false, null, "Name").SetsNothing().ShouldBeFalse();
    }

    [Fact]
    public void TheBlockBecomesTheDomainSettingsUnchanged()
    {
        var line = Guid.NewGuid();

        new OrderPublicWebsiteFields(true, true, line, "Name").ToSettings().ShouldBe(new OrderPublicSettings(true, true, line, "Name"));
    }
}
