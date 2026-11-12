using System.Net;
using System.Text.Json;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// CONT-03, PUB-02, D-05: <c>GET /api/v1/public/home</c> answers anonymously with the shown product lines as card data, the line
/// count, the first three shown testimonials in display order, and no recent work and no hero tag until plan 11-26. It has a strong
/// ETag, no-cache and 304 on a repeat.
/// </summary>
public sealed class PublicHomeEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/public/home";

    private static readonly string[] LineKeys = ["basketball", "volleyball", "moto", "longsleeves", "polo", "custom"];

    [Fact]
    public async Task AFreshlyMigratedDatabaseAnswersTheSixLineCardsAndNoTestimonialsRecentWorkOrHeroTag()
    {
        await using var rig = await TestimonialRig.StartAsync(database);

        var (document, _) = await rig.PublicHomeAsync();

        using (document)
        {
            var root = document.RootElement;
            var lines = root.GetProperty("lines");
            lines.EnumerateArray().Select(line => line.GetProperty("key").GetString()).ShouldBe(LineKeys);
            root.GetProperty("lineCount").GetInt32().ShouldBe(6);
            var basketball = lines[0];
            basketball.GetProperty("number").GetString().ShouldBe("23");
            basketball.GetProperty("title").GetString().ShouldBe("Basketball Jerseys");
            basketball.GetProperty("cardText").GetString().ShouldBe("Full sublimation tops and shorts, any colorway, names and numbers included.");
            basketball.GetProperty("placeholderArt").GetString().ShouldBe("basketball");
            lines.EnumerateArray().ShouldAllBe(line => line.GetProperty("cardPhoto").ValueKind == JsonValueKind.Null);
            root.GetProperty("testimonials").GetArrayLength().ShouldBe(0);
            root.GetProperty("recentWork").GetArrayLength().ShouldBe(0);
            root.GetProperty("heroTag").ValueKind.ShouldBe(JsonValueKind.Null);
        }
    }

    [Fact]
    public async Task TheAnswerHasAStrongETagAndNoCacheAndAMatchingIfNoneMatchGets304()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        using var client = rig.Factory.CreateClient();
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

    [Fact]
    public async Task AManagersTestimonialAppearsOnTheNextHomeReadWithItsWordsAndANewETag()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        var (before, oldEtag) = await rig.PublicHomeAsync();
        before.Dispose();

        await rig.AddAsync(TestimonialBody.Juan);

        var (document, newEtag) = await rig.PublicHomeAsync();
        using (document)
        {
            var testimonial = document.RootElement.GetProperty("testimonials").EnumerateArray().ShouldHaveSingleItem();
            testimonial.GetProperty("quote").GetString().ShouldBe("Seventeen pieces, names and numbers perfect.");
            testimonial.GetProperty("name").GetString().ShouldBe("Juan Dela Cruz");
            testimonial.GetProperty("teamOrRole").GetString().ShouldBe("Captain, Brgy. Sample Ballers");
            testimonial.GetProperty("stars").GetInt32().ShouldBe(5);
        }

        newEtag.ShouldNotBe(oldEtag);
    }

    [Fact]
    public async Task FourShownTestimonialsGiveOnlyTheFirstThreeInDisplayOrder()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        foreach (var name in new[] { "Ana", "Ben", "Cara", "Dino" })
        {
            await rig.AddAsync(TestimonialBody.Named(name, $"Quote from {name}."));
        }

        (await rig.PublicNamesAsync()).ShouldBe(["Ana", "Ben", "Cara"]);
    }

    [Fact]
    public async Task AHiddenTestimonialIsLeftOutAndTheNextShownOneTakesItsPlace()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        await rig.AddAsync(TestimonialBody.Named("Ana", "Quote from Ana."));
        await rig.AddAsync(TestimonialBody.Named("Ben", "Quote from Ben.", shown: false));
        await rig.AddAsync(TestimonialBody.Named("Cara", "Quote from Cara."));
        await rig.AddAsync(TestimonialBody.Named("Dino", "Quote from Dino."));

        (await rig.PublicNamesAsync()).ShouldBe(["Ana", "Cara", "Dino"]);
    }

    [Fact]
    public async Task AHiddenLineIsLeftOutOfTheCardsAndTheLineCountFollows()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        using var list = await rig.SendAsync(HttpMethod.Get, "/api/v1/product-lines", rig.Manager);
        using var lines = JsonDocument.Parse(await list.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var moto = lines.RootElement.EnumerateArray().Single(line => line.GetProperty("key").GetString() == "moto").GetProperty("id").GetGuid();

        using var response = await rig.SendAsync(HttpMethod.Post, $"/api/v1/product-lines/{moto:D}/hide", rig.Manager);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var (document, _) = await rig.PublicHomeAsync();
        using (document)
        {
            document.RootElement.GetProperty("lines").EnumerateArray().Select(line => line.GetProperty("key").GetString())
                .ShouldBe(["basketball", "volleyball", "longsleeves", "polo", "custom"]);
            document.RootElement.GetProperty("lineCount").GetInt32().ShouldBe(5);
        }
    }
}
