using Csps.Infrastructure.Images;

namespace Csps.Infrastructure.IntegrationTests.Images;

/// <summary>D-03, D-33: exactly 13 named sizes, none with f_auto, display sizes in WebP and the full size in JPEG.</summary>
public sealed class ImageNamedSizesTests
{
    [Fact]
    public void TheCatalogHasTheThirteenAgreedNames()
    {
        ImageNamedSizes.All.Select(size => size.Name).ShouldBe(
        [
            "csps_sq_44", "csps_sq_88", "csps_sq_176",
            "csps_card_320", "csps_card_480", "csps_card_640", "csps_card_800", "csps_card_960",
            "csps_view_640", "csps_view_960", "csps_view_1280", "csps_view_1600",
            "csps_full_2000",
        ]);
    }

    [Fact]
    public void NamesAreUnique()
    {
        ImageNamedSizes.All.Select(size => size.Name).Distinct(StringComparer.Ordinal).Count().ShouldBe(13);
    }

    [Fact]
    public void NoSizeUsesFAutoBecauseANamedSizeCannotHoldIt()
    {
        ImageNamedSizes.All.ShouldAllBe(size => !size.Transformation.Contains("f_auto", StringComparison.Ordinal));
    }

    [Fact]
    public void EveryDisplaySizeEndsInWebPAndTheFullSizeInJpeg()
    {
        foreach (var size in ImageNamedSizes.All.Where(size => size.Name != "csps_full_2000"))
        {
            size.Transformation.ShouldEndWith("/q_auto/f_webp", customMessage: size.Name);
        }

        ImageNamedSizes.Full.Transformation.ShouldEndWith("/q_auto/f_jpg");
    }

    [Fact]
    public void SquaresAndCardsFillAndViewsAndFullLimit()
    {
        ImageNamedSizes.Squares.ShouldAllBe(size => size.Crop == ImageCrop.Fill && size.Transformation.StartsWith("c_fill,g_auto,", StringComparison.Ordinal));
        ImageNamedSizes.Cards.ShouldAllBe(size => size.Crop == ImageCrop.Fill && size.Transformation.StartsWith("c_fill,g_auto,", StringComparison.Ordinal));
        ImageNamedSizes.Views.ShouldAllBe(size => size.Crop == ImageCrop.Limit && size.Transformation.StartsWith("c_limit,", StringComparison.Ordinal));
        ImageNamedSizes.Full.Crop.ShouldBe(ImageCrop.Limit);
    }

    [Fact]
    public void CardHeightsAreSixteenToTenOfTheWidth()
    {
        ImageNamedSizes.Cards.Select(size => (size.BoxWidth, size.BoxHeight)).ShouldBe([(320, 200), (480, 300), (640, 400), (800, 500), (960, 600)]);
        foreach (var size in ImageNamedSizes.Cards)
        {
            size.BoxHeight.ShouldBe(size.BoxWidth * 10 / 16);
            size.Transformation.ShouldBe($"c_fill,g_auto,w_{size.BoxWidth},h_{size.BoxHeight}/q_auto/f_webp");
        }
    }

    [Fact]
    public void TheExactTransformationTextsMatchTheAccountSetup()
    {
        ImageNamedSizes.SquareOf(44).Transformation.ShouldBe("c_fill,g_auto,w_44,h_44/q_auto/f_webp");
        ImageNamedSizes.SquareOf(176).Transformation.ShouldBe("c_fill,g_auto,w_176,h_176/q_auto/f_webp");
        ImageNamedSizes.Views[0].Transformation.ShouldBe("c_limit,w_640,h_640/q_auto/f_webp");
        ImageNamedSizes.Views[3].Transformation.ShouldBe("c_limit,w_1600,h_1600/q_auto/f_webp");
        ImageNamedSizes.Full.Transformation.ShouldBe("c_limit,w_2000,h_2000/q_auto/f_jpg");
    }
}
