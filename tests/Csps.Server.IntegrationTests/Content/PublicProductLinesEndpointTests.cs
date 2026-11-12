using System.Net;
using System.Text.Json;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// PUB-02, CONT-02, D-06, D-40: <c>GET /api/v1/public/product-lines</c> answers anonymously with the six seeded product lines in
/// display order, no prices, no photos, a strong ETag and 304 on a repeat.
/// </summary>
public sealed class PublicProductLinesEndpointTests
{
    private const string Route = "/api/v1/public/product-lines";

    private static readonly string[] LineKeys = ["basketball", "volleyball", "moto", "longsleeves", "polo", "custom"];

    [Fact]
    public async Task AFreshlyMigratedDatabaseAnswersTheSixSeededLinesInOrderWithNoPricesAndNoPhotos()
    {
        var fresh = await CspsDatabase.CreateAsync();
        await using (fresh)
        {
            await using var factory = CspsApiFactory.ForDatabase(fresh.ConnectionString);
            using var client = factory.CreateClient();

            using var response = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);

            response.StatusCode.ShouldBe(HttpStatusCode.OK);
            response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("application/json");
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            var lines = document.RootElement.GetProperty("lines");
            lines.EnumerateArray().Select(line => line.GetProperty("key").GetString()).ShouldBe(LineKeys);
            foreach (var line in lines.EnumerateArray())
            {
                line.GetProperty("startsAtPrice").ValueKind.ShouldBe(JsonValueKind.Null);
                line.GetProperty("minimumQuantity").ValueKind.ShouldBe(JsonValueKind.Null);
                line.GetProperty("hasGalleryItems").GetBoolean().ShouldBeFalse();
                var photos = line.GetProperty("photos");
                photos.GetProperty("main").ValueKind.ShouldBe(JsonValueKind.Null);
                photos.GetProperty("back").ValueKind.ShouldBe(JsonValueKind.Null);
                photos.GetProperty("fabric").ValueKind.ShouldBe(JsonValueKind.Null);
            }

            var basketball = lines[0];
            basketball.GetProperty("number").GetString().ShouldBe("23");
            basketball.GetProperty("title").GetString().ShouldBe("Basketball Jerseys");
            basketball.GetProperty("shortName").GetString().ShouldBe("Basketball");
            basketball.GetProperty("cardText").GetString().ShouldBe("Full sublimation tops and shorts, any colorway, names and numbers included.");
            basketball.GetProperty("description").GetString().ShouldBe(
                "Game-ready tops and shorts, printed edge to edge in any colorway. Built for full-court runs and summer liga heat.");
            basketball.GetProperty("placeholderArt").GetString().ShouldBe("basketball");
            var customize = basketball.GetProperty("customize");
            customize.GetProperty("fabric").GetString().ShouldBe("Dri-fit mesh, aircool or spandex blend");
            customize.GetProperty("collar").GetString().ShouldBe("V-neck, round or layered");
            customize.GetProperty("cut").GetString().ShouldBe("Standard, slim, women's fit and kids");
            customize.GetProperty("names").GetString().ShouldBe("Any font: front, back and shorts");
            customize.GetProperty("logos").GetString().ShouldBe("Team crest, sponsors and barangay seal in full color");
        }
    }

    [Fact]
    public async Task TheResponseHasAStrongETagAndNoCacheAndAMatchingIfNoneMatchGets304()
    {
        var fresh = await CspsDatabase.CreateAsync();
        await using (fresh)
        {
            await using var factory = CspsApiFactory.ForDatabase(fresh.ConnectionString);
            using var client = factory.CreateClient();
            using var first = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);
            first.StatusCode.ShouldBe(HttpStatusCode.OK);
            var etag = first.Headers.ETag.ShouldNotBeNull();
            etag.IsWeak.ShouldBeFalse();
            first.Headers.CacheControl.ShouldNotBeNull().NoCache.ShouldBeTrue();

            using var matching = ApiRequests.Get(Route);
            matching.Headers.TryAddWithoutValidation("If-None-Match", etag.ToString());
            using var repeat = await client.SendAsync(matching, TestContext.Current.CancellationToken);

            repeat.StatusCode.ShouldBe(HttpStatusCode.NotModified);
            (await repeat.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty();
            repeat.Headers.ETag.ShouldBe(etag);
        }
    }
}
