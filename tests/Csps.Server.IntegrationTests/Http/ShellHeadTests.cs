using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Csps.Application.Content;
using Csps.Domain.Content;
using Csps.Infrastructure.Images;
using Csps.Infrastructure.Persistence;
using Csps.Server.IntegrationTests.Content;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// PUB-04, D-25, D-42: the shell's head carries the stored business facts. The business name and tagline reach the Open Graph tags,
/// every public page carries <c>LocalBusiness</c> JSON-LD without the shop email, and every public page and the 404 shell carry the boot
/// data block, so the first visit needs no request. Typed text can never break out of a script block or an attribute.
/// </summary>
public sealed partial class ShellHeadTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Origin = "https://localhost";
    private const string FailingTagline = "</script><script>alert(1)</script>";

    [Fact]
    public async Task HomeCarriesTheStoredNameAndTaglineAndLocalBusinessData()
    {
        await using var factory = FactoryFor(Site(tagline: "Sample tagline"));
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, "/");

        Meta(body, "property", "og:site_name").ShouldBe("Sample Shop");
        Meta(body, "name", "description").ShouldBe("Sample tagline");
        Meta(body, "property", "og:description").ShouldBe("Sample tagline");
        var ld = LdJson(body).ShouldHaveSingleItem();
        using var document = JsonDocument.Parse(ld);
        var root = document.RootElement;
        root.GetProperty("@context").GetString().ShouldBe("https://schema.org");
        root.GetProperty("@type").GetString().ShouldBe("LocalBusiness");
        root.GetProperty("name").GetString().ShouldBe("Sample Shop");
        root.GetProperty("description").GetString().ShouldBe("Sample tagline");
        root.GetProperty("url").GetString().ShouldBe(Origin);
        root.GetProperty("telephone").GetString().ShouldBe("+639171234567");
        var address = root.GetProperty("address");
        address.GetProperty("@type").GetString().ShouldBe("PostalAddress");
        address.GetProperty("streetAddress").GetString().ShouldBe("12 Sample St., Poblacion");
        address.GetProperty("addressLocality").GetString().ShouldBe("Sample City");
        address.GetProperty("addressRegion").GetString().ShouldBe("Sample Province");
        address.GetProperty("postalCode").GetString().ShouldBe("1000");
        address.GetProperty("addressCountry").GetString().ShouldBe("PH");
        root.GetProperty("sameAs").EnumerateArray().Select(item => item.GetString()).ShouldBe(
            ["https://facebook.example.test/cspsdemo", "https://tiktok.example.test/cspsdemo"]);
        root.TryGetProperty("email", out _).ShouldBeFalse();
        ld.ShouldNotContain("mail", Case.Insensitive);
    }

    [Fact]
    public async Task EachOpenWeekdayBecomesAnOpeningHoursSpecificationAndSundayHasNone()
    {
        var week = Enumerable.Range(1, 7).Select(day => day <= 6 ? new DayHoursDto(day, "09:00", "18:00") : new DayHoursDto(day, null, null)).ToList();
        await using var factory = FactoryFor(Site(tagline: "Sample tagline") with { Hours = week });
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, "/contact");

        using var document = JsonDocument.Parse(LdJson(body).ShouldHaveSingleItem());
        var specs = document.RootElement.GetProperty("openingHoursSpecification").EnumerateArray().ToList();
        specs.Select(spec => spec.GetProperty("dayOfWeek").GetString()).ShouldBe(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
        specs.ShouldAllBe(spec => spec.GetProperty("@type").GetString() == "OpeningHoursSpecification");
        specs.ShouldAllBe(spec => spec.GetProperty("opens").GetString() == "09:00" && spec.GetProperty("closes").GetString() == "18:00");
    }

    [Fact]
    public async Task MixedHoursKeepEachDaysOwnTimesAndOnlyOpenDaysAreListed()
    {
        var week = Enumerable.Range(1, 7)
            .Select(day => day switch
            {
                1 => new DayHoursDto(day, "09:00", "18:00"),
                6 => new DayHoursDto(day, "10:30", "17:00"),
                7 => new DayHoursDto(day, "08:00", "12:00"),
                _ => new DayHoursDto(day, null, null),
            })
            .ToList();
        await using var factory = FactoryFor(Site(tagline: "Sample tagline") with { Hours = week });
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, "/");

        using var document = JsonDocument.Parse(LdJson(body).ShouldHaveSingleItem());
        var specs = document.RootElement.GetProperty("openingHoursSpecification").EnumerateArray().ToList();
        specs.Select(spec => (spec.GetProperty("dayOfWeek").GetString(), spec.GetProperty("opens").GetString(), spec.GetProperty("closes").GetString()))
            .ShouldBe([("Monday", "09:00", "18:00"), ("Saturday", "10:30", "17:00"), ("Sunday", "08:00", "12:00")]);
    }

    [Fact]
    public async Task WithNoOpenDayTheJsonLdHasNoOpeningHoursSpecification()
    {
        await using var factory = FactoryFor(Site(tagline: "Sample tagline"));
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, "/contact");

        using var document = JsonDocument.Parse(LdJson(body).ShouldHaveSingleItem());
        document.RootElement.TryGetProperty("openingHoursSpecification", out _).ShouldBeFalse();
    }

    [Fact]
    public async Task AClosureInFortyFiveDaysIsAClosedDayInTheSpecialHoursAndOneInSeventyDaysIsLeftOut()
    {
        var today = PublicContentSeeding.ManilaToday();
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await PublicContentSeeding.SaveClosuresAsync(database, [(today.AddDays(70), null, "Too far"), (today.AddDays(45), today.AddDays(47), "Holiday")]);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        string body;
        try
        {
            body = await GetBodyAsync(client, "/contact");
        }
        finally
        {
            await PublicContentSeeding.SaveClosuresAsync(database, []);
        }

        using var document = JsonDocument.Parse(LdJson(body).ShouldHaveSingleItem());
        var special = document.RootElement.GetProperty("specialOpeningHoursSpecification").EnumerateArray().ShouldHaveSingleItem();
        special.GetProperty("@type").GetString().ShouldBe("OpeningHoursSpecification");
        special.GetProperty("opens").GetString().ShouldBe("00:00");
        special.GetProperty("closes").GetString().ShouldBe("00:00");
        special.GetProperty("validFrom").GetString().ShouldBe(today.AddDays(45).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture));
        special.GetProperty("validThrough").GetString().ShouldBe(today.AddDays(47).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture));
        body.ShouldNotContain("Holiday", Case.Sensitive);
    }

    [Fact]
    public async Task ClosuresAreListedByFirstDayAndASingleDayHasTheSameValidFromAndValidThrough()
    {
        var today = PublicContentSeeding.ManilaToday();
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await PublicContentSeeding.SaveClosuresAsync(database, [(today.AddDays(30), null, null), (today.AddDays(5), today.AddDays(6), null)]);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        string body;
        try
        {
            body = await GetBodyAsync(client, "/");
        }
        finally
        {
            await PublicContentSeeding.SaveClosuresAsync(database, []);
        }

        using var document = JsonDocument.Parse(LdJson(body).ShouldHaveSingleItem());
        var specials = document.RootElement.GetProperty("specialOpeningHoursSpecification").EnumerateArray().ToList();
        specials.Select(special => special.GetProperty("validFrom").GetString()).ShouldBe(
            [today.AddDays(5).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture), today.AddDays(30).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture)]);
        specials[1].GetProperty("validThrough").GetString().ShouldBe(specials[1].GetProperty("validFrom").GetString());
    }

    [Fact]
    public async Task WithNoClosuresTheJsonLdHasNoSpecialOpeningHoursSpecification()
    {
        await using var factory = FactoryFor(Site(tagline: "Sample tagline"));
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, "/contact");

        using var document = JsonDocument.Parse(LdJson(body).ShouldHaveSingleItem());
        document.RootElement.TryGetProperty("specialOpeningHoursSpecification", out _).ShouldBeFalse();
    }

    [Fact]
    public async Task TheAboutTextIsTheJsonLdDescriptionWhenItIsSet()
    {
        await using var factory = FactoryFor(Site(tagline: "Sample tagline") with { AboutText = "About the sample shop." });
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, "/products");

        using var document = JsonDocument.Parse(LdJson(body).ShouldHaveSingleItem());
        document.RootElement.GetProperty("description").GetString().ShouldBe("About the sample shop.");
        Meta(body, "name", "description").ShouldBe("See our product lines, starting prices and everything you can customize, from fabric to names and numbers.");
    }

    [Fact]
    public async Task ValuesThatAreNotSetAreLeftOutOfTheJsonLd()
    {
        var bare = Site(tagline: "Sample tagline") with
        {
            Address = new PublicAddressDto(null, null, null, null),
            Phones = [],
            FacebookUrl = null,
            TiktokUrl = null,
            MessengerUrl = null,
        };
        await using var factory = FactoryFor(bare);
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, "/contact");

        using var document = JsonDocument.Parse(LdJson(body).ShouldHaveSingleItem());
        document.RootElement.EnumerateObject().Select(property => property.Name).ShouldBe(
            ["@context", "@type", "name", "description", "url"], ignoreOrder: true);
        LdJson(body).ShouldHaveSingleItem().ShouldNotContain("[");
    }

    [Fact]
    public async Task APartialAddressKeepsOnlyTheSetPartsAndTheCountry()
    {
        var partial = Site(tagline: "Sample tagline") with { Address = new PublicAddressDto(null, "Sample City", null, null) };
        await using var factory = FactoryFor(partial);
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, "/gallery");

        using var document = JsonDocument.Parse(LdJson(body).ShouldHaveSingleItem());
        var address = document.RootElement.GetProperty("address");
        address.EnumerateObject().Select(property => property.Name).ShouldBe(["@type", "addressLocality", "addressCountry"], ignoreOrder: true);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/products")]
    [InlineData("/gallery")]
    [InlineData("/contact")]
    [InlineData("/nope")]
    public async Task EveryPublicPageAndTheNotFoundShellCarryTheSameSiteJsonAsTheApi(string path)
    {
        await using var factory = FactoryFor(Site(tagline: "Sample tagline"));
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, path, allowNotFound: path == "/nope");
        var api = await client.GetStringAsync(new Uri("/api/v1/public/site", UriKind.Relative), TestContext.Current.CancellationToken);

        var boot = Boot(body).ShouldHaveSingleItem();
        using var document = JsonDocument.Parse(boot);
        document.RootElement.EnumerateObject().Select(property => property.Name).ShouldBe(path switch
        {
            "/products" => ["site", "productLines"],
            "/" => ["site", "home"],
            _ => ["site"],
        });
        document.RootElement.GetProperty("site").GetRawText().ShouldBe(api, path);
    }

    [Fact]
    public async Task TheHomeShellCarriesTheSameHomeJsonAsTheApi()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, "/");
        var api = await client.GetStringAsync(new Uri("/api/v1/public/home", UriKind.Relative), TestContext.Current.CancellationToken);

        using var document = JsonDocument.Parse(Boot(body).ShouldHaveSingleItem());
        document.RootElement.GetProperty("home").GetRawText().ShouldBe(api);
        document.RootElement.GetProperty("home").GetProperty("lines").GetArrayLength().ShouldBeGreaterThan(0);
    }

    [Theory]
    [InlineData("/products")]
    [InlineData("/gallery")]
    [InlineData("/contact")]
    [InlineData("/nope")]
    public async Task OtherPagesCarryNoHomeKey(string path)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, path, allowNotFound: path == "/nope");

        using var document = JsonDocument.Parse(Boot(body).ShouldHaveSingleItem());
        document.RootElement.TryGetProperty("home", out _).ShouldBeFalse(path);
    }

    [Fact]
    public async Task WhenOnlyTheHomeReadThrowsTheHomePageStillCarriesTheSiteAndTheFailureIsNotCached()
    {
        var reader = new StubPublicContentReader("Sample Shop") { HomeFailure = new InvalidOperationException("home is down") };
        await using var factory = new ShellTestFactory(reader);
        using var client = factory.CreateClient();

        var failing = await GetBodyAsync(client, "/");
        reader.HomeFailure = null;
        var recovered = await GetBodyAsync(client, "/");

        using var withoutHome = JsonDocument.Parse(Boot(failing).ShouldHaveSingleItem());
        withoutHome.RootElement.EnumerateObject().Select(property => property.Name).ShouldBe(["site"]);
        using var withHome = JsonDocument.Parse(Boot(recovered).ShouldHaveSingleItem());
        withHome.RootElement.EnumerateObject().Select(property => property.Name).ShouldBe(["site", "home"]);
    }

    [Fact]
    public async Task AfterATestimonialIsAddedTheNextHomeShellShowsItBecauseTheShellCacheWasCleared()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var contexts = factory.Services.GetRequiredService<IDbContextFactory<CspsDbContext>>();
        (await TestimonialNamesInBootAsync(client)).ShouldBeEmpty();

        try
        {
            await using (var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken))
            {
                context.Testimonials.Add(Testimonial.Create(new TestimonialValues("Seventeen pieces, names and numbers perfect.", "Juan Dela Cruz", null, 5, true), 1, new DateTimeOffset(2026, 11, 12, 8, 0, 0, TimeSpan.Zero)).Value);
                await context.SaveChangesAsync(TestContext.Current.CancellationToken);
            }

            (await TestimonialNamesInBootAsync(client)).ShouldBe(["Juan Dela Cruz"]);
        }
        finally
        {
            await database.ResetAsync();
        }
    }

    private static async Task<List<string>> TestimonialNamesInBootAsync(HttpClient client)
    {
        var body = await GetBodyAsync(client, "/");
        using var document = JsonDocument.Parse(Boot(body).ShouldHaveSingleItem());
        return [.. document.RootElement.GetProperty("home").GetProperty("testimonials").EnumerateArray().Select(item => item.GetProperty("name").GetString()!)];
    }

    [Fact]
    public async Task TheProductsShellCarriesTheSameProductLinesJsonAsTheApi()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, "/products");
        var api = await client.GetStringAsync(new Uri("/api/v1/public/product-lines", UriKind.Relative), TestContext.Current.CancellationToken);

        using var document = JsonDocument.Parse(Boot(body).ShouldHaveSingleItem());
        document.RootElement.GetProperty("productLines").GetRawText().ShouldBe(api);
        document.RootElement.GetProperty("productLines").GetProperty("lines").GetArrayLength().ShouldBeGreaterThan(0);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/gallery")]
    [InlineData("/contact")]
    [InlineData("/nope")]
    public async Task OtherPagesCarryNoProductLinesKey(string path)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, path, allowNotFound: path == "/nope");

        using var document = JsonDocument.Parse(Boot(body).ShouldHaveSingleItem());
        document.RootElement.TryGetProperty("productLines", out _).ShouldBeFalse(path);
    }

    [Fact]
    public async Task AfterAProductLineTitleChangeTheNextProductsShellShowsItBecauseTheShellCacheWasCleared()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var contexts = factory.Services.GetRequiredService<IDbContextFactory<CspsDbContext>>();
        (await TitlesInBootAsync(client)).ShouldContain("Basketball Jerseys");

        try
        {
            await SetBasketballTitleAsync(contexts, "Basketball Kits");

            (await TitlesInBootAsync(client)).ShouldContain("Basketball Kits");
        }
        finally
        {
            await SetBasketballTitleAsync(contexts, "Basketball Jerseys");
        }
    }

    [Fact]
    public async Task WhenOnlyTheProductLinesReadThrowsTheProductsPageStillCarriesTheSiteAndTheFailureIsNotCached()
    {
        var reader = new StubPublicContentReader("Sample Shop") { LinesFailure = new InvalidOperationException("lines are down") };
        await using var factory = new ShellTestFactory(reader);
        using var client = factory.CreateClient();

        var failing = await GetBodyAsync(client, "/products");
        reader.LinesFailure = null;
        var recovered = await GetBodyAsync(client, "/products");

        using var withoutLines = JsonDocument.Parse(Boot(failing).ShouldHaveSingleItem());
        withoutLines.RootElement.EnumerateObject().Select(property => property.Name).ShouldBe(["site"]);
        using var withLines = JsonDocument.Parse(Boot(recovered).ShouldHaveSingleItem());
        withLines.RootElement.EnumerateObject().Select(property => property.Name).ShouldBe(["site", "productLines"]);
    }

    [Fact]
    public async Task TheProductsPageUsesTheFirstActiveLinesMainPhotoAsItsLinkPreviewPicture()
    {
        var publicId = $"csps-test/content/lines/{BasketballId:D}/abcdefghijklmnopqrstuvwxyz";
        await AddMainPhotoAsync(publicId);
        try
        {
            await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
            using var client = factory.CreateClient();

            var body = await GetBodyAsync(client, "/products");

            var name = Meta(body, "property", "og:site_name").ShouldNotBeNull();
            Meta(body, "property", "og:image").ShouldBe($"{Origin}/api/testing/images/abcdefghijklmnopqrstuvwxyz?size=csps_sharec_1200");
            Meta(body, "property", "og:image:width").ShouldBe("1200");
            Meta(body, "property", "og:image:height").ShouldBe("630");
            Meta(body, "property", "og:image:alt").ShouldBe(name);
            Meta(body, "name", "twitter:card").ShouldBe("summary_large_image");
        }
        finally
        {
            await RemovePhotosAsync();
        }
    }

    [Fact]
    public async Task WithNoMainPhotoOnTheFirstActiveLineTheProductsPageHasNoPreviewPictureAndTheSmallCard()
    {
        await RemovePhotosAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, "/products");

        Meta(body, "property", "og:image").ShouldBeNull();
        Meta(body, "property", "og:image:width").ShouldBeNull();
        Meta(body, "property", "og:image:height").ShouldBeNull();
        Meta(body, "property", "og:image:alt").ShouldBeNull();
        Meta(body, "name", "twitter:card").ShouldBe("summary");
    }

    [Fact]
    public async Task TheGalleryPageUsesTheCoverOfTheTopPublicItemAsItsLinkPreviewPicture()
    {
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        await GallerySeeding.LinkProductTypesAsync(database);
        var now = new DateTimeOffset(2026, 11, 12, 8, 0, 0, TimeSpan.Zero);
        var staff = await OrderSeeding.AddStaffAsync(database, "Gallery", now);
        var ids = await GallerySeeding.AddOrdersAsync(
            database,
            [new SeedGalleryOrder("Top team") { Photos = [(1600, 900), (900, 1600)], Position = 1 }, new SeedGalleryOrder("Lower team") { Position = 2 }],
            staff,
            now);
        try
        {
            string coverId;
            await using (var context = database.CreateContext())
            {
                coverId = await context.Set<Csps.Domain.Orders.OrderImage>().AsNoTracking()
                    .Where(image => image.OrderId == ids[0] && image.Position == 0)
                    .Select(image => image.PublicId)
                    .SingleAsync(TestContext.Current.CancellationToken);
            }

            await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
            using var client = factory.CreateClient();

            var body = await GetBodyAsync(client, "/gallery");

            var name = Meta(body, "property", "og:site_name").ShouldNotBeNull();
            Meta(body, "property", "og:image").ShouldBe($"{Origin}/api/testing/images/{coverId[(coverId.LastIndexOf('/') + 1)..]}?size=csps_sharec_1200");
            Meta(body, "property", "og:image:width").ShouldBe("1200");
            Meta(body, "property", "og:image:height").ShouldBe("630");
            Meta(body, "property", "og:image:alt").ShouldBe(name);
            Meta(body, "name", "twitter:card").ShouldBe("summary_large_image");
            using var boot = JsonDocument.Parse(Boot(body).ShouldHaveSingleItem());
            boot.RootElement.EnumerateObject().Select(property => property.Name).ShouldBe(["site"], "the Gallery fetches its items and its boot data stays small");
        }
        finally
        {
            await database.ResetAsync();
            await ProductLineSeeding.RestoreSixAsync(database);
        }
    }

    [Fact]
    public async Task WhenOnlyTheGalleryReadThrowsTheGalleryPageStillCarriesTheSiteAndTheFailureIsNotCached()
    {
        var reader = new StubPublicContentReader("Sample Shop") { GalleryFailure = new InvalidOperationException("the gallery is down") };
        await using var factory = new ShellTestFactory(reader);
        using var client = factory.CreateClient();

        var failing = await GetBodyAsync(client, "/gallery");
        reader.GalleryFailure = null;
        reader.GalleryShareImageUrl = "/api/testing/images/abcdefghijklmnopqrstuvwxyz?size=csps_sharec_1200";
        var recovered = await GetBodyAsync(client, "/gallery");

        Meta(failing, "property", "og:site_name").ShouldBe("Sample Shop");
        Meta(failing, "property", "og:image").ShouldBeNull();
        Meta(recovered, "property", "og:image").ShouldBe($"{Origin}/api/testing/images/abcdefghijklmnopqrstuvwxyz?size=csps_sharec_1200");
    }

    [Fact]
    public async Task WithNoPublicGalleryItemTheGalleryPageHasNoPreviewPictureAndTheSmallCard()
    {
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, "/gallery");

        Meta(body, "property", "og:image").ShouldBeNull();
        Meta(body, "property", "og:image:width").ShouldBeNull();
        Meta(body, "property", "og:image:height").ShouldBeNull();
        Meta(body, "property", "og:image:alt").ShouldBeNull();
        Meta(body, "name", "twitter:card").ShouldBe("summary");
    }

    [Fact]
    public async Task WithNoPublicGalleryItemOnlyTheProductsPageCarriesALinkPreviewPictureAndEveryOtherPageHasTheSmallCard()
    {
        var publicId = $"csps-test/content/lines/{BasketballId:D}/abcdefghijklmnopqrstuvwxyz";
        await AddMainPhotoAsync(publicId);
        try
        {
            await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
            using var client = factory.CreateClient();

            foreach (var path in new[] { "/", "/gallery", "/contact" })
            {
                var body = await GetBodyAsync(client, path);

                Meta(body, "property", "og:image").ShouldBeNull(path);
                Meta(body, "name", "twitter:card").ShouldBe("summary", path);
            }
        }
        finally
        {
            await RemovePhotosAsync();
        }
    }

    [Fact]
    public async Task HomeContactAndTheNotFoundShellCarryTheDefaultSharePictureAsTheirLinkPreviewPicture()
    {
        await using var rig = await SharePictureRig.StartAsync(database, reset: false);
        using var uploaded = await rig.UploadAsync(SyntheticImages.Jpeg(1200, 630));
        uploaded.StatusCode.ShouldBe(HttpStatusCode.OK, await uploaded.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var storage = rig.Factory.Services.GetRequiredService<TestingImageStorage>();
        var publicId = storage.Uploads.Single(recorded => recorded.AssetFolder.Contains("/content/share/", StringComparison.Ordinal)).PublicId;
        var address = $"{Origin}/api/testing/images/{publicId[(publicId.LastIndexOf('/') + 1)..]}?size=csps_sharec_1200";
        using var client = rig.Factory.CreateClient();
        var name = Meta(await GetBodyAsync(client, "/"), "property", "og:site_name").ShouldNotBeNull();

        foreach (var path in new[] { "/", "/contact", "/nope" })
        {
            var body = await GetBodyAsync(client, path, allowNotFound: path == "/nope");

            Meta(body, "property", "og:image").ShouldBe(address, path);
            Meta(body, "property", "og:image:width").ShouldBe("1200", path);
            Meta(body, "property", "og:image:height").ShouldBe("630", path);
            Meta(body, "property", "og:image:alt").ShouldBe(name, path);
            Meta(body, "name", "twitter:card").ShouldBe("summary_large_image", path);
        }
    }

    [Fact]
    public async Task ProductsAndGalleryFallBackToTheDefaultSharePictureWhenTheyHaveNoPhotoOfTheirOwn()
    {
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        await using var rig = await SharePictureRig.StartAsync(database, reset: false);
        using var uploaded = await rig.UploadAsync(SyntheticImages.Jpeg(1200, 630));
        uploaded.StatusCode.ShouldBe(HttpStatusCode.OK);
        var address = DefaultAddress(rig);
        using var client = rig.Factory.CreateClient();

        foreach (var path in new[] { "/products", "/gallery" })
        {
            var body = await GetBodyAsync(client, path);

            Meta(body, "property", "og:image").ShouldBe(address, path);
            Meta(body, "property", "og:image:width").ShouldBe("1200", path);
            Meta(body, "property", "og:image:height").ShouldBe("630", path);
            Meta(body, "name", "twitter:card").ShouldBe("summary_large_image", path);
        }
    }

    [Fact]
    public async Task ProductsKeepsItsOwnLinePhotoOverTheDefaultSharePicture()
    {
        var publicId = $"csps-test/content/lines/{BasketballId:D}/abcdefghijklmnopqrstuvwxyz";
        await AddMainPhotoAsync(publicId);
        try
        {
            await using var rig = await SharePictureRig.StartAsync(database, reset: false);
            using var uploaded = await rig.UploadAsync(SyntheticImages.Jpeg(1200, 630));
            uploaded.StatusCode.ShouldBe(HttpStatusCode.OK);
            using var client = rig.Factory.CreateClient();

            var products = await GetBodyAsync(client, "/products");
            var home = await GetBodyAsync(client, "/");

            Meta(products, "property", "og:image").ShouldBe($"{Origin}/api/testing/images/abcdefghijklmnopqrstuvwxyz?size=csps_sharec_1200");
            Meta(home, "property", "og:image").ShouldBe(DefaultAddress(rig));
        }
        finally
        {
            await RemovePhotosAsync();
        }
    }

    [Fact]
    public async Task GalleryKeepsTheCoverOfItsTopItemOverTheDefaultSharePicture()
    {
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        await GallerySeeding.LinkProductTypesAsync(database);
        var now = new DateTimeOffset(2026, 11, 12, 8, 0, 0, TimeSpan.Zero);
        var staff = await OrderSeeding.AddStaffAsync(database, "Gallery", now);
        var ids = await GallerySeeding.AddOrdersAsync(database, [new SeedGalleryOrder("Top team") { Photos = [(1600, 900)], Position = 1 }], staff, now);
        try
        {
            await using var rig = await SharePictureRig.StartAsync(database, reset: false);
            using var uploaded = await rig.UploadAsync(SyntheticImages.Jpeg(1200, 630));
            uploaded.StatusCode.ShouldBe(HttpStatusCode.OK);
            string coverId;
            await using (var context = database.CreateContext())
            {
                coverId = await context.Set<Csps.Domain.Orders.OrderImage>().AsNoTracking()
                    .Where(image => image.OrderId == ids[0] && image.Position == 0)
                    .Select(image => image.PublicId)
                    .SingleAsync(TestContext.Current.CancellationToken);
            }

            using var client = rig.Factory.CreateClient();
            var body = await GetBodyAsync(client, "/gallery");

            Meta(body, "property", "og:image").ShouldBe($"{Origin}/api/testing/images/{coverId[(coverId.LastIndexOf('/') + 1)..]}?size=csps_sharec_1200");
            Meta(body, "property", "og:image").ShouldNotBe(DefaultAddress(rig));
        }
        finally
        {
            await database.ResetAsync();
            await ProductLineSeeding.RestoreSixAsync(database);
        }
    }

    [Fact]
    public async Task TheJsonLdImageIsTheDefaultSharePictureAndIsAbsentWithNone()
    {
        await using var rig = await SharePictureRig.StartAsync(database, reset: false);
        using var client = rig.Factory.CreateClient();
        using (var without = JsonDocument.Parse(LdJson(await GetBodyAsync(client, "/")).ShouldHaveSingleItem()))
        {
            without.RootElement.TryGetProperty("image", out _).ShouldBeFalse();
        }

        using var uploaded = await rig.UploadAsync(SyntheticImages.Jpeg(1200, 630));
        uploaded.StatusCode.ShouldBe(HttpStatusCode.OK);

        foreach (var path in new[] { "/", "/contact", "/products", "/gallery" })
        {
            using var with = JsonDocument.Parse(LdJson(await GetBodyAsync(client, path)).ShouldHaveSingleItem());
            with.RootElement.GetProperty("image").GetString().ShouldBe(DefaultAddress(rig), path);
        }
    }

    // The 1200 x 630 address of the picture a rig stored, as a page head writes it.
    private static string DefaultAddress(SharePictureRig rig)
    {
        var publicId = rig.Factory.Services.GetRequiredService<TestingImageStorage>().Uploads
            .Last(recorded => recorded.AssetFolder.Contains("/content/share/", StringComparison.Ordinal)).PublicId;
        return $"{Origin}/api/testing/images/{publicId[(publicId.LastIndexOf('/') + 1)..]}?size=csps_sharec_1200";
    }

    private static readonly Guid BasketballId = ProductLineSeed.All.Single(entry => entry.Key == "basketball").Id;

    private async Task AddMainPhotoAsync(string publicId)
    {
        await RemovePhotosAsync();
        await using var context = database.CreateContext();
        context.ProductLinePhotos.Add(ProductLinePhoto.Create(BasketballId, ProductLinePhotoSlot.Main, publicId, 1600, 900, 120_000, "jpg", new DateTimeOffset(2026, 11, 12, 9, 0, 0, TimeSpan.Zero)));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task RemovePhotosAsync()
    {
        await using var context = database.CreateContext();
        await context.ProductLinePhotos.ExecuteDeleteAsync(TestContext.Current.CancellationToken);
    }

    private static async Task<List<string>> TitlesInBootAsync(HttpClient client)
    {
        var body = await GetBodyAsync(client, "/products");
        using var document = JsonDocument.Parse(Boot(body).ShouldHaveSingleItem());
        return [.. document.RootElement.GetProperty("productLines").GetProperty("lines").EnumerateArray().Select(line => line.GetProperty("title").GetString()!)];
    }

    private static async Task SetBasketballTitleAsync(IDbContextFactory<CspsDbContext> contexts, string title)
    {
        await using var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var line = await context.ProductLines.SingleAsync(row => row.Key == "basketball", TestContext.Current.CancellationToken);
        context.Entry(line).Property(row => row.Title).CurrentValue = title;
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task TheNotFoundShellHasNoJsonLd()
    {
        await using var factory = FactoryFor(Site(tagline: "Sample tagline"));
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, "/nope", allowNotFound: true);

        LdJson(body).ShouldBeEmpty();
    }

    [Theory]
    [InlineData("/admin")]
    [InlineData("/admin/orders")]
    [InlineData("/dev/components")]
    public async Task AdminAndDevPagesCarryNoBootDataAndNoJsonLd(string path)
    {
        await using var factory = FactoryFor(Site(tagline: "Sample tagline"));
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, path);

        body.ShouldNotContain("csps-boot", Case.Sensitive, path);
        body.ShouldNotContain("application/ld+json", Case.Sensitive, path);
    }

    [Fact]
    public async Task ScriptBreakoutInTheTaglineAndTheNameStaysInertInTheJsonBlocksAndTheAttributes()
    {
        var hostile = Site(tagline: FailingTagline) with { BusinessName = FailingTagline, AboutText = FailingTagline };
        await using var factory = FactoryFor(hostile);
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, "/");

        body.ShouldNotContain("<script>alert(1)", Case.Insensitive);
        body.ShouldNotContain("</script><script", Case.Insensitive);
        body.ShouldContain("\\u003C/script\\u003E", Case.Sensitive);
        body.Split("</script>").Length.ShouldBe(3, "one closing tag for the JSON-LD block and one for the boot block, nothing else");
        LdJson(body).ShouldHaveSingleItem().ShouldNotContain("<");
        Boot(body).ShouldHaveSingleItem().ShouldNotContain("<");
        Meta(body, "name", "description").ShouldBe(FailingTagline);
        body.ShouldContain("content=\"&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;\"", Case.Sensitive);
        using var document = JsonDocument.Parse(Boot(body).ShouldHaveSingleItem());
        document.RootElement.GetProperty("site").GetProperty("tagline").GetString().ShouldBe(FailingTagline);
    }

    [Theory]
    [InlineData("/products", true)]
    [InlineData("/", true)]
    [InlineData("/gallery", false)]
    public async Task ScriptBreakoutInTheLineTestimonialAndGalleryTextStaysInertInTheBootBlock(string path, bool bootCarriesTheText)
    {
        var reader = new StubPublicContentReader(Site(tagline: "Sample tagline"))
        {
            ProductLines = new PublicProductLinesDto([HostileLine()]),
            Home = new PublicHomeDto(
                [new PublicHomeLineDto("basketball", "23", FailingTagline, FailingTagline, "basketball", null)],
                1,
                [new PublicTestimonialDto(FailingTagline, FailingTagline, FailingTagline, 5)],
                [new PublicRecentWorkDto(FailingTagline, "basketball", FailingTagline, 12, "basketball", null)],
                new PublicHeroTagDto(FailingTagline, 12)),
            Gallery = new PublicGalleryDto(
                [new PublicGalleryItemDto(Guid.NewGuid(), FailingTagline, "basketball", FailingTagline, 12, FailingTagline, "basketball", [])],
                [new PublicGalleryPillDto("basketball", FailingTagline, 1)],
                1),
            // The one field the Gallery page reads from the gallery is the share picture address, so that is the hostile one.
            GalleryShareImageUrl = $"/{FailingTagline}",
        };
        await using var factory = new ShellTestFactory(reader);
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, path);

        body.ShouldNotContain("<script>alert(1)", Case.Insensitive, path);
        body.ShouldNotContain("</script><script", Case.Insensitive, path);
        body.Split("</script>").Length.ShouldBe(3, $"{path}: one closing tag for the JSON-LD block and one for the boot block, nothing else");
        LdJson(body).ShouldHaveSingleItem().ShouldNotContain("<");
        var boot = Boot(body).ShouldHaveSingleItem();
        boot.ShouldNotContain("<");
        boot.ShouldNotContain("alert(1)</", Case.Insensitive);
        if (bootCarriesTheText)
        {
            boot.ShouldContain("u003C/script", Case.Sensitive, path);
            using var document = JsonDocument.Parse(boot);
            var text = path == "/products"
                ? document.RootElement.GetProperty("productLines").GetProperty("lines")[0].GetProperty("title").GetString()
                : document.RootElement.GetProperty("home").GetProperty("testimonials")[0].GetProperty("name").GetString();
            text.ShouldBe(FailingTagline);
        }

        if (path == "/gallery")
        {
            const string encodedAddress = "/&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;";
            body.ShouldContain($"property=\"og:image\" content=\"{Origin}{encodedAddress}\"", Case.Sensitive);
            Meta(body, "property", "og:image").ShouldBe($"{Origin}/{FailingTagline}");
            Meta(body, "name", "twitter:card").ShouldBe("summary_large_image");
        }
    }

    [Fact]
    public async Task WhenTheSnapshotReadThrowsThePagesAreStillSentWithoutBootDataOrJsonLd()
    {
        await using var factory = new ShellTestFactory(new StubPublicContentReader(new InvalidOperationException("content is down")));
        using var client = factory.CreateClient();

        using var home = await client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
        using var missing = await client.GetAsync(new Uri("/nope", UriKind.Relative), TestContext.Current.CancellationToken);

        home.StatusCode.ShouldBe(HttpStatusCode.OK);
        missing.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var homeBody = await home.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var missingBody = await missing.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        homeBody.ShouldContain("<title>CSPS fixture</title>", Case.Sensitive);
        homeBody.ShouldNotContain("csps-boot", Case.Sensitive);
        missingBody.ShouldContain("<title>Page Not Found · CSPS</title>", Case.Sensitive);
        missingBody.ShouldNotContain("csps-boot", Case.Sensitive);
    }

    [Fact]
    public async Task AfterATaglineChangeTheNextPageShowsItBecauseTheShellCacheWasCleared()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo("First line"));
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var first = await client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
        var firstBody = await first.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Meta(firstBody, "name", "description").ShouldBe("First line");

        var contexts = factory.Services.GetRequiredService<IDbContextFactory<CspsDbContext>>();
        await using (var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken))
        {
            await PublicContentSeeding.SaveAsync(context, PublicContentSeeding.Demo("Second line"), new DateTimeOffset(2026, 11, 12, 8, 0, 0, TimeSpan.Zero));
        }

        using var second = await client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
        var secondBody = await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Meta(secondBody, "name", "description").ShouldBe("Second line");
        Meta(secondBody, "property", "og:description").ShouldBe("Second line");
        second.Headers.ETag.ShouldNotBe(first.Headers.ETag);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/products")]
    [InlineData("/gallery")]
    [InlineData("/contact")]
    [InlineData("/nope")]
    [InlineData("/robots.txt")]
    [InlineData("/sitemap.xml")]
    [InlineData("/api/v1/public/site")]
    public async Task NoPublicBodyHoldsTheShopEmailOrAnAtSign(string path)
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        // The only "@" a public body may hold is in the JSON-LD keywords "@context" and "@type" and in the TikTok profile link.
        var withoutKeywords = body
            .Replace("\"@context\"", string.Empty, StringComparison.Ordinal)
            .Replace("\"@type\"", string.Empty, StringComparison.Ordinal)
            .Replace("tiktok.com/@", "tiktok.com/", StringComparison.Ordinal);
        body.ShouldNotContain("shop-private@example.test", Case.Insensitive, path);
        body.ShouldNotContain("mailto:", Case.Insensitive, path);
        withoutKeywords.ShouldNotContain("@", Case.Sensitive, path);
    }

    [Fact]
    public async Task AnEmptySettingsRowStillGivesAPageWithNoPlaceholder()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Bare());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, "/contact");

        using var document = JsonDocument.Parse(LdJson(body).ShouldHaveSingleItem());
        document.RootElement.TryGetProperty("telephone", out _).ShouldBeFalse();
        document.RootElement.TryGetProperty("address", out _).ShouldBeFalse();
        document.RootElement.TryGetProperty("sameAs", out _).ShouldBeFalse();
        using var boot = JsonDocument.Parse(Boot(body).ShouldHaveSingleItem());
        boot.RootElement.GetProperty("site").GetProperty("phones").GetArrayLength().ShouldBe(0);
    }

    private static PublicProductLineDto HostileLine() => new(
        "basketball",
        "23",
        FailingTagline,
        FailingTagline,
        FailingTagline,
        FailingTagline,
        new PublicCustomizeDto(FailingTagline, FailingTagline, FailingTagline, FailingTagline, FailingTagline),
        650m,
        12,
        "basketball",
        new PublicLinePhotosDto(null, null, null),
        true);

    [Theory]
    [InlineData("/privacy", "Privacy Policy · CSPS", "How we collect, use and protect your personal information, and your rights under the Data Privacy Act of 2012.")]
    [InlineData("/cookies", "Cookie Policy · CSPS", "Which cookies this site uses, why, and how to change your choice at any time.")]
    [InlineData("/terms", "Terms of Use · CSPS", "The rules for using this website and asking us for a quote.")]
    [InlineData("/accessibility", "Accessibility Statement · CSPS", "We want everyone to be able to use this website. Here is what we do, and how to tell us about a problem.")]
    public async Task ALegalPageSendsItsTitleAndLeadAndIsKeptOutOfSearchResultsWhileDraft(string path, string title, string lead)
    {
        await using var factory = new ShellTestFactory(new StubPublicContentReader(Site(tagline: "Sample tagline")), new ApprovedLegalPages());
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, path);

        body.ShouldContain($"<title>{title}</title>", Case.Sensitive, path);
        Meta(body, "name", "description").ShouldBe(lead, path);
        Meta(body, "property", "og:description").ShouldBe(lead, path);
        Meta(body, "name", "robots").ShouldBe("noindex, nofollow", path);
    }

    [Theory]
    [InlineData("/privacy", "Privacy Policy · CSPS", "How we collect, use and protect your personal information, and your rights under the Data Privacy Act of 2012.")]
    [InlineData("/cookies", "Cookie Policy · CSPS", "Which cookies this site uses, why, and how to change your choice at any time.")]
    [InlineData("/terms", "Terms of Use · CSPS", "The rules for using this website and asking us for a quote.")]
    [InlineData("/accessibility", "Accessibility Statement · CSPS", "We want everyone to be able to use this website. Here is what we do, and how to tell us about a problem.")]
    public async Task AnApprovedLegalPageSendsItsTitleAndLeadAndCarriesNoRobotsMeta(string path, string title, string lead)
    {
        await using var factory = FactoryFor(Site(tagline: "Sample tagline"));
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, path);

        body.ShouldContain($"<title>{title}</title>", Case.Sensitive, path);
        Meta(body, "name", "description").ShouldBe(lead, path);
        Meta(body, "property", "og:description").ShouldBe(lead, path);
        Meta(body, "name", "robots").ShouldBeNull(path);
    }

    [Fact]
    public async Task ApprovingOneLegalPageRemovesItsNoindexAndLeavesTheOthersMarked()
    {
        await using var factory = new ShellTestFactory(new StubPublicContentReader(Site(tagline: "Sample tagline")), new ApprovedLegalPages("/terms"));
        using var client = factory.CreateClient();

        Meta(await GetBodyAsync(client, "/terms"), "name", "robots").ShouldBeNull();
        Meta(await GetBodyAsync(client, "/privacy"), "name", "robots").ShouldBe("noindex, nofollow");
        Meta(await GetBodyAsync(client, "/cookies"), "name", "robots").ShouldBe("noindex, nofollow");
        Meta(await GetBodyAsync(client, "/accessibility"), "name", "robots").ShouldBe("noindex, nofollow");
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/products")]
    [InlineData("/gallery")]
    [InlineData("/contact")]
    public async Task APageThatIsNotLegalCarriesNoRobotsMeta(string path)
    {
        await using var factory = FactoryFor(Site(tagline: "Sample tagline"));
        using var client = factory.CreateClient();

        var body = await GetBodyAsync(client, path);

        Meta(body, "name", "robots").ShouldBeNull(path);
    }

    private static ShellTestFactory FactoryFor(PublicSiteDto site) => new(new StubPublicContentReader(site));

    private static PublicSiteDto Site(string tagline) => StubPublicContentReader.Site("Sample Shop", tagline);

    private static async Task<string> GetBodyAsync(HttpClient client, string path, bool allowNotFound = false)
    {
        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(allowNotFound ? HttpStatusCode.NotFound : HttpStatusCode.OK, path);
        return await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
    }

    private static List<string> LdJson(string html) => [.. LdJsonBlock().Matches(html).Select(match => match.Groups[1].Value)];

    private static List<string> Boot(string html) => [.. BootBlock().Matches(html).Select(match => match.Groups[1].Value)];

    private static string? Meta(string html, string attribute, string key)
    {
        var tag = MetaTag().Matches(html).Select(match => match.Value).FirstOrDefault(value => value.Contains($"{attribute}=\"{key}\"", StringComparison.Ordinal));
        if (tag is null)
        {
            return null;
        }

        var content = ContentAttribute().Match(tag);
        return content.Success ? WebUtility.HtmlDecode(content.Groups[1].Value) : null;
    }

    [GeneratedRegex("<script type=\"application/ld\\+json\">(.*?)</script>", RegexOptions.Singleline | RegexOptions.CultureInvariant)]
    private static partial Regex LdJsonBlock();

    [GeneratedRegex("<script type=\"application/json\" id=\"csps-boot\">(.*?)</script>", RegexOptions.Singleline | RegexOptions.CultureInvariant)]
    private static partial Regex BootBlock();

    [GeneratedRegex("<meta\\b[^>]*>", RegexOptions.CultureInvariant)]
    private static partial Regex MetaTag();

    [GeneratedRegex("\\scontent=\"([^\"]*)\"", RegexOptions.CultureInvariant)]
    private static partial Regex ContentAttribute();
}
