using Csps.Application.Images;

namespace Csps.Application.UnitTests.Images;

/// <summary>IMG-02: the upload limits default to 10 MB, 25 megapixels and 10,000 pixels, and configuration may lower them but never raise the byte limit.</summary>
public sealed class ImageUploadSettingsTests
{
    [Fact]
    public void TheDefaultsAreValid()
    {
        var settings = new ImageUploadSettings();

        settings.Validate().ShouldBeNull();
        settings.MaxBytes.ShouldBe(10_485_760);
        settings.MaxPixels.ShouldBe(25_000_000);
        settings.MaxSide.ShouldBe(10_000);
        ImageUploadLimits.BodyBytes.ShouldBeGreaterThan(ImageUploadLimits.MaxFileBytes);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(10_485_760)]
    public void AByteLimitInsideTheRangeIsAccepted(int bytes)
    {
        new ImageUploadSettings { MaxBytes = bytes }.Validate().ShouldBeNull();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(10_485_761)]
    public void AByteLimitOutsideTheRangeIsRefused(int bytes)
    {
        new ImageUploadSettings { MaxBytes = bytes }.Validate().ShouldBe($"Images:MaxBytes must be from 1 to {ImageUploadLimits.MaxFileBytes}.");
    }

    [Fact]
    public void AZeroPixelOrSideLimitIsRefused()
    {
        new ImageUploadSettings { MaxPixels = 0 }.Validate().ShouldBe("Images:MaxPixels must be at least 1.");
        new ImageUploadSettings { MaxSide = 0 }.Validate().ShouldBe("Images:MaxSide must be at least 1.");
    }
}
