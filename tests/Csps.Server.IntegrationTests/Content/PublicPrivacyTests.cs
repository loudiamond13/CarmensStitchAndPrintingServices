using System.Net;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// GAL-01, D-11, D-13, T-11-65: the Data Privacy Act promise. One shown order carries distinctive customer values, a price and a photo
/// description, and none of them appears in any public answer or in the head of any public page. The test walks every public route and
/// every shell.
/// </summary>
public sealed class PublicPrivacyTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 8, 0, 0, TimeSpan.Zero);

    private static readonly string[] PublicRoutes =
    [
        "/api/v1/public/site",
        "/api/v1/public/open-status",
        "/api/v1/public/product-lines",
        "/api/v1/public/home",
        PublicGalleryRig.GalleryRoute,
    ];

    private static readonly string[] ShellRoutes = ["/", "/products", "/gallery", "/contact", "/no-such-page"];

    private static readonly string[] Secrets =
    [
        SeedGalleryOrder.PrivateCustomerName,
        SeedGalleryOrder.PrivatePhone,
        "09179990001",
        "+639179990001",
        SeedGalleryOrder.PrivateEmail,
        SeedGalleryOrder.PrivateAddress,
        SeedGalleryOrder.PrivateNotes,
        SeedGalleryOrder.PrivateItemDescription,
        SeedGalleryOrder.PrivatePhotoDescription,
        "1234.56",
        "1,234.56",
        "PRIVATE-",
    ];

    [Fact]
    public async Task EveryPublicRouteHoldsNoCustomerValueNoPriceAndNoPhotoDescriptionEvenWhileItShowsTheOrder()
    {
        await using var factory = await StartWithShownOrderAsync();
        using var client = factory.CreateClient();

        foreach (var route in PublicRoutes)
        {
            using var response = await client.GetAsync(new Uri(route, UriKind.Relative), TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.OK, route);
            var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            foreach (var secret in Secrets)
            {
                body.ShouldNotContain(secret, Case.Insensitive, $"{route} must not hold {secret}");
            }
        }

        using var gallery = await client.GetAsync(new Uri(PublicGalleryRig.GalleryRoute, UriKind.Relative), TestContext.Current.CancellationToken);
        (await gallery.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("Brgy. Sample Ballers", Case.Sensitive, "the order itself is public, only its private values are not");
    }

    [Fact]
    public async Task EveryShellHoldsNoCustomerValueNoPriceAndNoPhotoDescriptionInItsHeadOrItsBootData()
    {
        await using var factory = await StartWithShownOrderAsync();
        using var client = factory.CreateClient();

        foreach (var route in ShellRoutes)
        {
            using var response = await client.GetAsync(new Uri(route, UriKind.Relative), TestContext.Current.CancellationToken);
            var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            body.ShouldContain("<html", Case.Insensitive, route);
            foreach (var secret in Secrets)
            {
                body.ShouldNotContain(secret, Case.Insensitive, $"the {route} shell must not hold {secret}");
            }
        }
    }

    [Fact]
    public async Task TheGalleryJsonNamesOnlyThePublicFieldsOfAnItem()
    {
        await using var factory = await StartWithShownOrderAsync();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(PublicGalleryRig.GalleryRoute, UriKind.Relative), TestContext.Current.CancellationToken);
        using var document = System.Text.Json.JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

        var item = document.RootElement.GetProperty("items").EnumerateArray().ShouldHaveSingleItem();
        item.EnumerateObject().Select(property => property.Name).ShouldBe(["id", "team", "lineKey", "lineShortName", "pieces", "note", "placeholderArt", "photos"]);
        item.GetProperty("photos")[0].EnumerateObject().Select(property => property.Name)
            .ShouldBe(["src", "srcSet", "viewerSrc", "viewerSrcSet", "thumbSrc", "width", "height"]);
    }

    private async Task<Csps.Testing.CspsApiFactory> StartWithShownOrderAsync()
    {
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        await GallerySeeding.LinkProductTypesAsync(database);
        var staff = await OrderSeeding.AddStaffAsync(database, "Gallery", Now);
        await GallerySeeding.AddOrdersAsync(database, [new SeedGalleryOrder("Brgy. Sample Ballers") { Pieces = 17, Photos = [(800, 600), (600, 800)] }], staff, Now);
        return CspsApiFactory.ForDatabase(database.ConnectionString);
    }
}
