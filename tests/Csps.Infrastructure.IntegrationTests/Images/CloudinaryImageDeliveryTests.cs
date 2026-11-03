using System.Text.RegularExpressions;
using Csps.Application.Images;
using Csps.Infrastructure.Images;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.IntegrationTests.Images;

/// <summary>IMG-03, IMG-04, D-01, D-03, D-04, D-32: photo addresses are private, named-size and never larger than the photo.</summary>
public sealed partial class CloudinaryImageDeliveryTests
{
    private const string Id = "csps/orders/0b0f/abcdefghijklmnopqrstuvwxyz";
    private const string Base = "https://res.cloudinary.com/demo-cloud/image/private/";

    private static CloudinaryImageDelivery Delivery(string cloud = "demo-cloud") =>
        new(Options.Create(new CloudinarySettings { CloudName = cloud, ApiKey = "fake-key", ApiSecret = "fake-secret", RootFolder = "csps" }));

    private static string Address(string name) => $"{Base}t_{name}/v1/{Id}";

    private static string Widths(params (string Name, int Width)[] candidates) =>
        string.Join(", ", candidates.Select(candidate => $"{Address(candidate.Name)} {candidate.Width}w"));

    private static List<(string Address, string Descriptor)> Parse(string srcSet) =>
        [.. srcSet.Split(", ").Select(part => (part[..part.LastIndexOf(' ')], part[(part.LastIndexOf(' ') + 1)..]))];

    [Fact]
    public void TheTileThumbIsThePrivateNamedSizeAddressWithATwoTimesCandidate()
    {
        var thumb = Delivery().ForPhoto(Id, 4000, 3000).Thumb;

        thumb.Src.ShouldBe(Address("csps_sq_88"));
        thumb.SrcSet.ShouldBe($"{Address("csps_sq_88")} 1x, {Address("csps_sq_176")} 2x");
    }

    [Fact]
    public void TheViewerOffersSixHundredFortyToSixteenHundredWideForALandscapePhoto()
    {
        var viewer = Delivery().ForPhoto(Id, 4000, 3000).Viewer;

        viewer.SrcSet.ShouldBe(Widths(("csps_view_640", 640), ("csps_view_960", 960), ("csps_view_1280", 1280), ("csps_view_1600", 1600)));
        viewer.Src.ShouldBe(Address("csps_view_960"));
    }

    [Fact]
    public void TheViewerStopsAtTheFirstSizeAtOrAboveThePhotoAndReportsItsOwnWidth()
    {
        var viewer = Delivery().ForPhoto(Id, 1000, 750).Viewer;

        viewer.SrcSet.ShouldBe(Widths(("csps_view_640", 640), ("csps_view_960", 960), ("csps_view_1280", 1000)));
    }

    [Fact]
    public void APortraitPhotoReportsTheTrueWidthOfEachViewerSize()
    {
        var viewer = Delivery().ForPhoto(Id, 3000, 4000).Viewer;

        viewer.SrcSet.ShouldBe(Widths(("csps_view_640", 480), ("csps_view_960", 720), ("csps_view_1280", 960), ("csps_view_1600", 1200)));
    }

    [Fact]
    public void AViewerWidthRoundsAHalfAwayFromZero()
    {
        // 640 / 768 x 3 = 2.5, which must become 3 (a banker's round would give 2); the larger size repeats the width.
        var viewer = Delivery().ForPhoto(Id, 3, 768).Viewer;

        viewer.SrcSet.ShouldBe(Widths(("csps_view_640", 3)));
    }

    [Fact]
    public void WidthsThatCollapseToTheSameNumberAppearOnceAndNeverBelowOne()
    {
        var viewer = Delivery().ForPhoto(Id, 1, 3200).Viewer;

        viewer.SrcSet.ShouldBe(Widths(("csps_view_640", 1)));
    }

    [Fact]
    public void TheCardCoverOffersThreeTwentyToNineSixtyWide()
    {
        var card = Delivery().ForCover(Id, 4000, 3000).Card;

        card.SrcSet.ShouldBe(Widths(("csps_card_320", 320), ("csps_card_480", 480), ("csps_card_640", 640), ("csps_card_800", 800), ("csps_card_960", 960)));
        card.Src.ShouldBe(Address("csps_card_640"));
    }

    [Fact]
    public void ACardCoverNeverOffersASizeWiderThanThePhoto()
    {
        var card = Delivery().ForCover(Id, 500, 400).Card;

        card.SrcSet.ShouldBe(Widths(("csps_card_320", 320), ("csps_card_480", 480)));
        card.Src.ShouldBe(Address("csps_card_480"));
    }

    [Fact]
    public void ACardCoverOfAWidePanoramaIsLimitedByTheWidthOfItsSixteenToTenCrop()
    {
        // The 16:10 crop of a 1000 x 300 photo is 480 wide; 640 would stretch it.
        var card = Delivery().ForCover(Id, 1000, 300).Card;

        card.SrcSet.ShouldBe(Widths(("csps_card_320", 320), ("csps_card_480", 480)));
    }

    [Fact]
    public void TheTableThumbIsFortyFourAtOneTimesAndEightyEightAtTwoTimes()
    {
        var table = Delivery().ForCover(Id, 4000, 3000).Table;

        table.Src.ShouldBe(Address("csps_sq_44"));
        table.SrcSet.ShouldBe($"{Address("csps_sq_44")} 1x, {Address("csps_sq_88")} 2x");
    }

    [Fact]
    public void ASquareSlotDropsItsTwoTimesCandidateWhenTheShorterSideIsTooSmall()
    {
        var delivery = Delivery();

        delivery.ForPhoto(Id, 150, 100).Thumb.SrcSet.ShouldBe($"{Address("csps_sq_88")} 1x");
        delivery.ForCover(Id, 60, 50).Table.SrcSet.ShouldBe($"{Address("csps_sq_44")} 1x");
        delivery.ForPhoto(Id, 4000, 170).Thumb.SrcSet.ShouldBe($"{Address("csps_sq_88")} 1x");
    }

    [Fact]
    public void APhotoSmallerThanEveryCandidateGetsOneCandidatePerSlotAtItsOwnSizeNeverAnUpscale()
    {
        var delivery = Delivery();

        var photo = delivery.ForPhoto(Id, 30, 20);
        var cover = delivery.ForCover(Id, 30, 20);

        photo.Thumb.SrcSet.ShouldBe($"{Address("csps_sq_88")} 1x");
        photo.Viewer.SrcSet.ShouldBe(Widths(("csps_view_640", 30)));
        photo.Viewer.Src.ShouldBe(Address("csps_view_640"));
        cover.Card.SrcSet.ShouldBe(Widths(("csps_card_320", 30)));
        cover.Card.Src.ShouldBe(Address("csps_card_320"));
        cover.Table.SrcSet.ShouldBe($"{Address("csps_sq_44")} 1x");
    }

    [Fact]
    public void FullSizeIsTheTwoThousandPixelJpegAddress()
    {
        Delivery().ForPhoto(Id, 4000, 3000).FullSize.ShouldBe(Address("csps_full_2000"));
        Delivery().ForPhoto(Id, 30, 20).FullSize.ShouldBe(Address("csps_full_2000"));
    }

    [Theory]
    [InlineData(4000, 3000)]
    [InlineData(3000, 4000)]
    [InlineData(1000, 750)]
    [InlineData(500, 400)]
    [InlineData(2000, 2000)]
    [InlineData(1, 3200)]
    [InlineData(3200, 1)]
    [InlineData(30, 20)]
    [InlineData(1000, 300)]
    public void EveryAddressIsPrivateAndNamedAndEveryWidthIsAscendingUniqueAndNoWiderThanThePhoto(int width, int height)
    {
        var delivery = Delivery();
        var photo = delivery.ForPhoto(Id, width, height);
        var cover = delivery.ForCover(Id, width, height);
        var catalog = ImageNamedSizes.All.Select(size => size.Name).ToHashSet(StringComparer.Ordinal);
        var shape = AddressShape();

        List<string> everyAddress = [photo.FullSize];
        foreach (var source in new[] { photo.Thumb, photo.Viewer, cover.Card, cover.Table })
        {
            everyAddress.Add(source.Src);
            everyAddress.AddRange(Parse(source.SrcSet).Select(candidate => candidate.Address));
        }

        foreach (var address in everyAddress)
        {
            var match = shape.Match(address);
            match.Success.ShouldBeTrue(address);
            catalog.ShouldContain(match.Groups["name"].Value);
            address.ShouldNotContain("f_auto");
        }

        foreach (var source in new[] { photo.Viewer, cover.Card })
        {
            var widths = Parse(source.SrcSet).Select(candidate => int.Parse(candidate.Descriptor[..^1], System.Globalization.CultureInfo.InvariantCulture)).ToList();
            widths.ShouldBe([.. widths.Distinct().Order()]);
            widths.ShouldAllBe(candidate => candidate >= 1 && candidate <= width);
            source.SrcSet.Split(", ").ShouldContain(part => part.StartsWith(source.Src + " ", StringComparison.Ordinal));
        }
    }

    [Fact]
    public void AddressesNeverCarryAUploadVersionOrAnUnsizedOriginal()
    {
        var photo = Delivery().ForPhoto(Id, 4000, 3000);

        photo.Thumb.Src.ShouldContain("/image/private/t_");
        photo.Thumb.Src.ShouldContain("/v1/");
        photo.Viewer.SrcSet.ShouldNotContain("/image/upload/");
        photo.FullSize.ShouldStartWith(Base + "t_");
    }

    [Theory]
    [InlineData("")]
    [InlineData("CSPS/orders/a/b")]
    [InlineData("csps/orders/../secret")]
    [InlineData("csps/orders/a b")]
    [InlineData("csps/orders/a?x=1")]
    [InlineData("csps//orders")]
    [InlineData("/csps/orders/a")]
    [InlineData("csps/orders/a/")]
    [InlineData("csps/orders/a%2fb")]
    public void APublicIdOutsideTheStoredShapeIsRefused(string publicId)
    {
        Should.Throw<ArgumentException>(() => Delivery().ForPhoto(publicId, 100, 100));
        Should.Throw<ArgumentException>(() => Delivery().ForCover(publicId, 100, 100));
    }

    [Fact]
    public void ANullPublicIdIsRefused()
    {
        Should.Throw<ArgumentException>(() => Delivery().ForPhoto(null!, 100, 100));
    }

    [Theory]
    [InlineData(0, 100)]
    [InlineData(100, 0)]
    [InlineData(-1, 100)]
    [InlineData(100, -5)]
    public void ASizeThatIsNotPositiveIsRefused(int width, int height)
    {
        Should.Throw<ArgumentOutOfRangeException>(() => Delivery().ForPhoto(Id, width, height));
        Should.Throw<ArgumentOutOfRangeException>(() => Delivery().ForCover(Id, width, height));
    }

    [Fact]
    public void AMissingCloudNameStopsTheBuilderInsteadOfMakingBrokenAddresses()
    {
        Should.Throw<InvalidOperationException>(() => Delivery(string.Empty).ForPhoto(Id, 100, 100));
    }

    [GeneratedRegex(@"^https://res\.cloudinary\.com/demo-cloud/image/private/t_(?<name>[a-z0-9_]+)/v1/csps/orders/0b0f/abcdefghijklmnopqrstuvwxyz$")]
    private static partial Regex AddressShape();
}
