using System.Net;
using System.Text.Json;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// GAL-01, D-10, D-12, D-13, D-30: <c>GET /api/v1/public/gallery</c> answers anonymously with every shown item in gallery order, the
/// pill counts and the total, with a strong ETag and no-cache. An order is one item with all its photos, and only public text.
/// </summary>
public sealed class PublicGalleryEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AShownOrderIsOneItemWithItsLinePiecesPhotosAndPillAndTheAnswerHasAnETagThatEarnsA304()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        await rig.ShowOrderAsync("Brgy. Sample Ballers", [10, 7], (800, 600), (600, 800));

        var (document, etag) = await rig.GalleryAsync();

        using (document)
        {
            var root = document.RootElement;
            var item = root.GetProperty("items").EnumerateArray().ShouldHaveSingleItem();
            item.GetProperty("team").GetString().ShouldBe("Brgy. Sample Ballers");
            item.GetProperty("lineKey").GetString().ShouldBe("basketball");
            item.GetProperty("lineShortName").GetString().ShouldBe("Basketball");
            item.GetProperty("pieces").GetInt32().ShouldBe(17);
            item.GetProperty("note").ValueKind.ShouldBe(JsonValueKind.Null);
            item.GetProperty("placeholderArt").GetString().ShouldBe("basketball");
            var photos = item.GetProperty("photos").EnumerateArray().ToList();
            photos.Count.ShouldBe(2);
            photos.Select(photo => (photo.GetProperty("width").GetInt32(), photo.GetProperty("height").GetInt32())).ShouldBe([(800, 600), (600, 800)]);
            foreach (var photo in photos)
            {
                photo.GetProperty("src").GetString().ShouldNotBeNull().ShouldStartWith("/api/testing/images/");
                photo.GetProperty("srcSet").GetString().ShouldNotBeNull().ShouldContain("w, ");
                photo.GetProperty("viewerSrc").GetString().ShouldNotBeNull().ShouldContain("size=csps_view_");
                photo.GetProperty("viewerSrcSet").GetString().ShouldNotBeNull().ShouldContain("w");
                photo.GetProperty("thumbSrc").GetString().ShouldNotBeNull().ShouldContain("size=csps_sq_");
            }

            var pill = root.GetProperty("pills").EnumerateArray().ShouldHaveSingleItem();
            pill.GetProperty("key").GetString().ShouldBe("basketball");
            pill.GetProperty("shortName").GetString().ShouldBe("Basketball");
            pill.GetProperty("count").GetInt32().ShouldBe(1);
            root.GetProperty("total").GetInt32().ShouldBe(1);
        }

        etag.ShouldNotBeNullOrEmpty();
        using var client = rig.Factory.CreateClient();
        using var matching = ApiRequests.Get(PublicGalleryRig.GalleryRoute);
        matching.Headers.TryAddWithoutValidation("If-None-Match", etag);
        using var repeat = await client.SendAsync(matching, TestContext.Current.CancellationToken);
        repeat.StatusCode.ShouldBe(HttpStatusCode.NotModified);
        (await repeat.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty();
    }

    [Fact]
    public async Task TheAnswerIsAnonymousWithAStrongETagAndNoCache()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        using var client = rig.Factory.CreateClient();

        using var response = await client.GetAsync(new Uri(PublicGalleryRig.GalleryRoute, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.ETag.ShouldNotBeNull().IsWeak.ShouldBeFalse();
        response.Headers.CacheControl.ShouldNotBeNull().NoCache.ShouldBeTrue();
    }
}
