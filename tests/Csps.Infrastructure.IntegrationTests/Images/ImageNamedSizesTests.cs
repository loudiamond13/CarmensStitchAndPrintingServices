using Csps.Infrastructure.Images;

namespace Csps.Infrastructure.IntegrationTests.Images;

/// <summary>D-03, D-33, D-44: the 13 Phase 9 named sizes keep their names and come first, the 21 Phase 11 sizes follow, none uses f_auto, display sizes are WebP and the full and share sizes are JPEG.</summary>
public sealed class ImageNamedSizesTests
{
    [Fact]
    public void TheFirstThirteenAreTheAgreedPhase9Names()
    {
        ImageNamedSizes.All.Take(13).Select(size => size.Name).ShouldBe(
        [
            "csps_sq_44", "csps_sq_88", "csps_sq_176",
            "csps_card_320", "csps_card_480", "csps_card_640", "csps_card_800", "csps_card_960",
            "csps_view_640", "csps_view_960", "csps_view_1280", "csps_view_1600",
            "csps_full_2000",
        ]);
    }

    [Fact]
    public void NamesAreUniqueAndEveryNameAndTransformationIsListedOnce()
    {
        ImageNamedSizes.All.Count.ShouldBe(34);
        ImageNamedSizes.All.Select(size => size.Name).Distinct(StringComparer.Ordinal).Count().ShouldBe(34);
        ImageNamedSizes.Phase11.ShouldAllBe(size => ImageNamedSizes.All.Count(listed => ReferenceEquals(listed, size)) == 1);
        ImageNamedSizes.All.Skip(13).ShouldBe(ImageNamedSizes.Phase11);
    }

    [Fact]
    public void ThePhase11SizesHaveTheAgreedNamesInOrder()
    {
        ImageNamedSizes.Phase11.Select(size => size.Name).ShouldBe(
        [
            "csps_cat_320", "csps_cat_480", "csps_cat_640", "csps_cat_800", "csps_cat_960",
            "csps_strip_240", "csps_strip_480", "csps_strip_720", "csps_strip_1060",
            "csps_w_280", "csps_w_400", "csps_w_560", "csps_w_640", "csps_w_800", "csps_w_1280",
            "csps_sq_200", "csps_sq_400", "csps_sq_720",
            "csps_share_1200",
            "csps_share_320", "csps_share_640",
        ]);
    }

    [Fact]
    public void TheShareSizeIs1200By630AndAJpegAndThePreviewsAre191ToOne()
    {
        ImageNamedSizes.Share.Transformation.ShouldBe("c_fill,g_auto,w_1200,h_630/q_auto/f_jpg");
        (ImageNamedSizes.Share.BoxWidth, ImageNamedSizes.Share.BoxHeight, ImageNamedSizes.Share.Crop).ShouldBe((1200, 630, ImageCrop.Fill));
        ImageNamedSizes.SharePreviews.Select(size => (size.BoxWidth, size.BoxHeight)).ShouldBe([(320, 168), (640, 336)]);
        ImageNamedSizes.SharePreviews.ShouldAllBe(size => size.Transformation == $"c_fill,g_auto,w_{size.BoxWidth},h_{size.BoxHeight}/q_auto/f_webp");
    }

    [Fact]
    public void CategoryCardsAndStripsAreFourToFiveFillsWidthsLimitTheWidthAndProductSquaresFillSquares()
    {
        ImageNamedSizes.CategoryCards.Select(size => (size.BoxWidth, size.BoxHeight)).ShouldBe([(320, 400), (480, 600), (640, 800), (800, 1000), (960, 1200)]);
        ImageNamedSizes.Strips.Select(size => (size.BoxWidth, size.BoxHeight)).ShouldBe([(240, 300), (480, 600), (720, 900), (1060, 1325)]);
        ImageNamedSizes.CategoryCards.Concat(ImageNamedSizes.Strips).ShouldAllBe(size => size.Crop == ImageCrop.Fill && size.Transformation == $"c_fill,g_auto,w_{size.BoxWidth},h_{size.BoxHeight}/q_auto/f_webp");
        ImageNamedSizes.Widths.Select(size => size.BoxWidth).ShouldBe([280, 400, 560, 640, 800, 1280]);
        ImageNamedSizes.Widths.ShouldAllBe(size => size.Crop == ImageCrop.Limit && size.Transformation == $"c_limit,w_{size.BoxWidth}/q_auto/f_webp");
        ImageNamedSizes.ProductSquares.Select(size => size.BoxWidth).ShouldBe([200, 400, 720]);
        ImageNamedSizes.ProductSquares.ShouldAllBe(size => size.BoxWidth == size.BoxHeight && size.Transformation == $"c_fill,g_auto,w_{size.BoxWidth},h_{size.BoxWidth}/q_auto/f_webp");
        ImageNamedSizes.WidthOf(640).Name.ShouldBe("csps_w_640");
    }

    [Fact]
    public void NoSizeUsesFAutoBecauseANamedSizeCannotHoldIt()
    {
        ImageNamedSizes.All.ShouldAllBe(size => !size.Transformation.Contains("f_auto", StringComparison.Ordinal));
    }

    [Fact]
    public void EveryDisplaySizeEndsInWebPAndTheFullSizeInJpeg()
    {
        foreach (var size in ImageNamedSizes.All.Where(size => size.Name is not ("csps_full_2000" or "csps_share_1200")))
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
