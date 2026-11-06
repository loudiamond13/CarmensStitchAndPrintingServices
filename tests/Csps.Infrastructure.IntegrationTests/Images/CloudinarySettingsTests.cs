using Csps.Infrastructure.Images;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.IntegrationTests.Images;

/// <summary>D-07, T-09-07: development photos live in csps-dev and live photos in csps, and neither can point at the other.</summary>
public sealed class CloudinarySettingsTests
{
    private const string FakeKey = "fake-key-0000";
    private const string FakeSecret = "fake-secret-0000";

    private static CloudinarySettings Settings(string root, string cloud = "demo-cloud") =>
        new() { CloudName = cloud, ApiKey = FakeKey, ApiSecret = FakeSecret, RootFolder = root };

    private static ValidateOptionsResult Check(string environment, CloudinarySettings settings) =>
        new CloudinarySettings.Validator(environment).Validate(null, settings);

    [Theory]
    [InlineData("Production", "csps")]
    [InlineData("Development", "csps-dev")]
    [InlineData("Staging", "csps-dev")]
    [InlineData("Testing", "csps-test")]
    public void TheRightFolderForTheEnvironmentIsValid(string environment, string root)
    {
        Check(environment, Settings(root)).Succeeded.ShouldBeTrue();
    }

    [Fact]
    public void ProductionRefusesAnyFolderButCsps()
    {
        var result = Check("Production", Settings("csps-dev"));

        result.Failed.ShouldBeTrue();
        result.Failures.ShouldContain("Cloudinary:RootFolder must be csps in Production.");
    }

    [Theory]
    [InlineData("Development")]
    [InlineData("Staging")]
    [InlineData("Testing")]
    [InlineData("Anything")]
    public void EveryOtherEnvironmentRefusesTheLiveFolder(string environment)
    {
        var result = Check(environment, Settings("csps"));

        result.Failed.ShouldBeTrue();
        result.Failures.ShouldContain("Cloudinary:RootFolder csps is the live folder. Use csps-dev outside Production.");
    }

    [Fact]
    public void TheEnvironmentNameIsMatchedWithoutRegardToCase()
    {
        Check("production", Settings("csps-dev")).Failed.ShouldBeTrue();
        Check("PRODUCTION", Settings("csps")).Succeeded.ShouldBeTrue();
    }

    [Theory]
    [InlineData("Production", "Csps/Dev")]
    [InlineData("Development", "Csps/Dev")]
    [InlineData("Development", "csps/dev")]
    [InlineData("Development", "csps dev")]
    [InlineData("Development", "csps_dev")]
    [InlineData("Development", "CSPS-DEV")]
    [InlineData("Development", "csps-dev/")]
    [InlineData("Development", "../csps")]
    public void AFolderThatIsNotLowercaseLettersDigitsAndHyphensIsRefused(string environment, string root)
    {
        var result = Check(environment, Settings(root));

        result.Failed.ShouldBeTrue();
        result.Failures.ShouldContain("Cloudinary:RootFolder may use lowercase letters, digits and hyphens only.");
    }

    [Theory]
    [InlineData("Demo Cloud")]
    [InlineData("demo_cloud")]
    [InlineData("Demo")]
    [InlineData("demo/cloud")]
    public void ACloudNameThatIsNotLowercaseLettersDigitsAndHyphensIsRefused(string cloud)
    {
        var result = Check("Development", Settings("csps-dev", cloud));

        result.Failed.ShouldBeTrue();
        result.Failures.ShouldContain("Cloudinary:CloudName may use lowercase letters, digits and hyphens only.");
    }

    [Fact]
    public void AHostWithNoPhotoSettingsAtAllStillStartsInEveryEnvironment()
    {
        Check("Production", new CloudinarySettings()).Succeeded.ShouldBeTrue();
        Check("Development", new CloudinarySettings()).Succeeded.ShouldBeTrue();
    }

    [Fact]
    public void KeysWithoutAFolderAreRefusedSoAnEmptyFolderCannotReachTheAccountRoot()
    {
        var production = Check("Production", Settings(string.Empty));
        var development = Check("Development", Settings(string.Empty));

        production.Failures.ShouldNotBeNull().ShouldContain("Cloudinary:RootFolder must be csps in Production.");
        development.Failures.ShouldNotBeNull().ShouldContain("Cloudinary:RootFolder must be set. Use csps-dev outside Production.");
    }

    [Fact]
    public void AFailureNeverRepeatsTheKeyTheSecretOrTheFolderValue()
    {
        var result = Check("Production", Settings("csps-dev"));

        var message = result.FailureMessage.ShouldNotBeNull();
        message.ShouldNotContain(FakeKey);
        message.ShouldNotContain(FakeSecret);
        message.ShouldNotContain("csps-dev");
    }

    [Fact]
    public void ANamelessEnvironmentIsRefused()
    {
        Should.Throw<ArgumentException>(() => new CloudinarySettings.Validator(" "));
    }

    [Theory]
    [InlineData("csps", "csps/orders/")]
    [InlineData("csps-dev", "csps-dev/orders/")]
    public void OrdersPrefixEndsWithASlashSoCspsNeverMatchesCspsDev(string root, string expected)
    {
        Settings(root).OrdersPrefix.ShouldBe(expected);
        "csps-dev/orders/x".StartsWith(Settings("csps").OrdersPrefix, StringComparison.Ordinal).ShouldBeFalse();
    }

    [Theory]
    [InlineData("demo-cloud", "k", "s", true)]
    [InlineData("", "k", "s", false)]
    [InlineData("demo-cloud", "", "s", false)]
    [InlineData("demo-cloud", "k", "", false)]
    [InlineData("", "", "", false)]
    public void IsConfiguredNeedsTheCloudNameTheKeyAndTheSecret(string cloud, string key, string secret, bool expected)
    {
        new CloudinarySettings { CloudName = cloud, ApiKey = key, ApiSecret = secret, RootFolder = "csps-dev" }.IsConfigured.ShouldBe(expected);
    }

    [Fact]
    public void TheSectionIsCalledCloudinary()
    {
        CloudinarySettings.SectionName.ShouldBe("Cloudinary");
    }
}
