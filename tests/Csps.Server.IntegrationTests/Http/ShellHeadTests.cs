using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Csps.Application.Content;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
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

        var body = await GetBodyAsync(client, "/contact");
        await PublicContentSeeding.SaveClosuresAsync(database, []);

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

        var body = await GetBodyAsync(client, "/");
        await PublicContentSeeding.SaveClosuresAsync(database, []);

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
        document.RootElement.EnumerateObject().Select(property => property.Name).ShouldBe(["site"]);
        document.RootElement.GetProperty("site").GetRawText().ShouldBe(api, path);
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

        // The only "@" a public body may hold is in the JSON-LD keywords "@context" and "@type".
        var withoutKeywords = body.Replace("\"@context\"", string.Empty, StringComparison.Ordinal).Replace("\"@type\"", string.Empty, StringComparison.Ordinal);
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
