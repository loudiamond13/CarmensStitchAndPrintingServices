using Csps.Application.Analytics;

namespace Csps.Application.UnitTests.Analytics;

/// <summary>ANL-07, OR-3, T-12-23: the server half of the consent rules; each bad field gets one plain-English message.</summary>
public sealed class RecordConsentRequestValidatorTests
{
    private const string Chain = "0a1b2c3d4e5f4a6b8c7d9e0f1a2b3c4d";
    private static readonly RecordConsentRequestValidator Validator = new();

    [Fact]
    public void AValidAcceptAllPasses() =>
        Validator.Validate(new RecordConsentRequest(null, "0.1", true, true, "bar")).IsValid.ShouldBeTrue();

    [Theory]
    [InlineData("bar")]
    [InlineData("settings")]
    [InlineData("map-link")]
    public void EachBrowserSourcePasses(string source) =>
        Validator.Validate(new RecordConsentRequest(null, "1.0", false, false, source)).IsValid.ShouldBeTrue();

    [Fact]
    public void AMapOnlySaveWithNullStatsPasses() =>
        Validator.Validate(new RecordConsentRequest(Chain, "1.0", null, true, "map-link")).IsValid.ShouldBeTrue();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void AMissingPolicyVersionIsRefusedWithTheRequiredMessage(string? version)
    {
        var result = Validator.Validate(new RecordConsentRequest(null, version, true, true, "bar"));

        result.Errors.Where(error => error.PropertyName == nameof(RecordConsentRequest.PolicyVersion)).Select(error => error.ErrorMessage)
            .ShouldBe([RecordConsentRequestValidator.PolicyVersionRequired]);
    }

    [Theory]
    [InlineData("1")]
    [InlineData("1.")]
    [InlineData(".1")]
    [InlineData("1.0.0")]
    [InlineData("v1.0")]
    [InlineData("1.0 ")]
    [InlineData("1,0")]
    [InlineData("12345678.123456789")]
    public void APolicyVersionThatIsNotDigitsDotDigitsIsRefused(string version)
    {
        var result = Validator.Validate(new RecordConsentRequest(null, version, true, true, "bar"));

        result.Errors.Where(error => error.PropertyName == nameof(RecordConsentRequest.PolicyVersion)).Select(error => error.ErrorMessage)
            .ShouldBe([RecordConsentRequestValidator.PolicyVersionInvalid]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("clear")]
    [InlineData("Bar")]
    [InlineData("mapLink")]
    [InlineData("4")]
    public void ASourceThatIsNotOneOfTheThreeBrowserOnesIsRefused(string? source)
    {
        var result = Validator.Validate(new RecordConsentRequest(null, "1.0", true, true, source));

        result.Errors.Where(error => error.PropertyName == nameof(RecordConsentRequest.Source)).Select(error => error.ErrorMessage)
            .ShouldBe([RecordConsentRequestValidator.SourceInvalid]);
    }

    [Theory]
    [InlineData("0A1B2C3D4E5F4A6B8C7D9E0F1A2B3C4D")]
    [InlineData("0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d")]
    [InlineData("0a1b2c3d4e5f4a6b8c7d9e0f1a2b3c4")]
    [InlineData("0a1b2c3d4e5f4a6b8c7d9e0f1a2b3c4de")]
    [InlineData("zz1b2c3d4e5f4a6b8c7d9e0f1a2b3c4d")]
    [InlineData(" ")]
    public void AConsentIdThatIsNotThirtyTwoLowercaseHexCharactersIsRefused(string consentId)
    {
        var result = Validator.Validate(new RecordConsentRequest(consentId, "1.0", true, true, "bar"));

        result.Errors.Where(error => error.PropertyName == nameof(RecordConsentRequest.ConsentId)).Select(error => error.ErrorMessage)
            .ShouldBe([RecordConsentRequestValidator.ConsentIdInvalid]);
    }

    [Fact]
    public void AnEmptyBodyNamesEveryRequiredField()
    {
        var result = Validator.Validate(RecordConsentRequest.Empty);

        result.Errors.Select(error => error.PropertyName).Distinct().ShouldBe(
            [nameof(RecordConsentRequest.PolicyVersion), nameof(RecordConsentRequest.Source)], ignoreOrder: true);
    }

    [Fact]
    public void TheMessagesArePlainEnglishWithNoLongDash()
    {
        foreach (var message in new[]
        {
            RecordConsentRequestValidator.PolicyVersionRequired,
            RecordConsentRequestValidator.PolicyVersionInvalid,
            RecordConsentRequestValidator.SourceInvalid,
            RecordConsentRequestValidator.ConsentIdInvalid,
        })
        {
            message.ShouldEndWith(".");
            message.ShouldNotContain('—');
            message.ShouldNotContain('–');
        }
    }
}
