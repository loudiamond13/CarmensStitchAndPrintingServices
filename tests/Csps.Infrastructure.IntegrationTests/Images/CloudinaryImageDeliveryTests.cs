using Csps.Infrastructure.Images;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.IntegrationTests.Images;

/// <summary>IMG-03, IMG-04, D-01, D-03, D-32: photo addresses are private, named-size and never larger than the photo.</summary>
public sealed class CloudinaryImageDeliveryTests
{
    private const string Id = "csps/orders/0b0f/abcdefghijklmnopqrstuvwxyz";
    private const string Base = "https://res.cloudinary.com/demo-cloud/image/private/";

    private static CloudinaryImageDelivery Delivery() =>
        new(Options.Create(new CloudinarySettings { CloudName = "demo-cloud", ApiKey = "fake-key", ApiSecret = "fake-secret", RootFolder = "csps" }));

    private static string Address(string name) => $"{Base}t_{name}/v1/{Id}";

    [Fact]
    public void TheTileThumbIsThePrivateNamedSizeAddressWithATwoTimesCandidate()
    {
        var thumb = Delivery().ForPhoto(Id, 4000, 3000).Thumb;

        thumb.Src.ShouldBe(Address("csps_sq_88"));
        thumb.SrcSet.ShouldBe($"{Address("csps_sq_88")} 1x, {Address("csps_sq_176")} 2x");
    }
}
