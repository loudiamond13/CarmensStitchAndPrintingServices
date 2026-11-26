using System.Net;
using System.Xml.Linq;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// PUB-04: <c>/robots.txt</c> and <c>/sitemap.xml</c> are built from App:PublicBaseUrl and the route table, never from
/// the request's Host header, and are anonymous and never rate limited.
/// </summary>
public sealed class SeoEndpointTests
{
    private const string Origin = "https://localhost";

    // The one literal sitemap for the default factory: a change to the legal page facts must show up as an edit here.
    private static readonly string[] DefaultSitemapLocs =
        [$"{Origin}/", $"{Origin}/products", $"{Origin}/gallery", $"{Origin}/contact", $"{Origin}/privacy", $"{Origin}/terms", $"{Origin}/accessibility"];

    [Fact]
    public async Task RobotsAllowsTheSiteDisallowsAdminAndApiAndNamesTheSitemap()
    {
        await using var factory = new ShellTestFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/robots.txt", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("text/plain");
        var lines = (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        lines.ShouldContain("User-agent: *");
        lines.ShouldContain("Allow: /");
        lines.ShouldContain("Disallow: /admin");
        lines.ShouldContain("Disallow: /api");
        lines.ShouldContain($"Sitemap: {Origin}/sitemap.xml");
    }

    [Fact]
    public async Task SitemapListsTheFourPublicPagesUnderTheConfiguredOriginWhileEveryLegalPageIsADraft()
    {
        await using var factory = new ShellTestFactory(new StubPublicContentReader(ShellTestFactory.DefaultBusinessName), new ApprovedLegalPages());
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/sitemap.xml", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("application/xml");
        var document = XDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        XNamespace ns = "http://www.sitemaps.org/schemas/sitemap/0.9";
        document.Root.ShouldNotBeNull().Name.ShouldBe(ns + "urlset");
        document.Root.Elements(ns + "url").Select(url => url.Element(ns + "loc")!.Value).ShouldBe(
            [$"{Origin}/", $"{Origin}/products", $"{Origin}/gallery", $"{Origin}/contact"]);
    }

    [Fact]
    public async Task SitemapListsThePublicPagesAndTheApprovedLegalPagesInRouteOrder()
    {
        await using var factory = new ShellTestFactory();
        using var client = factory.CreateClient();

        var document = XDocument.Parse(await client.GetStringAsync(new Uri("/sitemap.xml", UriKind.Relative), TestContext.Current.CancellationToken));

        XNamespace ns = "http://www.sitemaps.org/schemas/sitemap/0.9";
        document.Root.ShouldNotBeNull().Elements(ns + "url").Select(url => url.Element(ns + "loc")!.Value).ShouldBe(
            DefaultSitemapLocs);
    }

    [Theory]
    [InlineData("/privacy")]
    [InlineData("/terms")]
    [InlineData("/accessibility")]
    public async Task TheSitemapLeavesOutEveryLegalPageWhileItIsADraft(string path)
    {
        await using var factory = new ShellTestFactory(new StubPublicContentReader("Sample Shop"), new ApprovedLegalPages());
        using var client = factory.CreateClient();

        var body = await client.GetStringAsync(new Uri("/sitemap.xml", UriKind.Relative), TestContext.Current.CancellationToken);

        body.ShouldNotContain($"{Origin}{path}<", Case.Sensitive, path);
    }

    [Fact]
    public async Task TheSitemapNeverListsTheOldCookiePolicyPath()
    {
        await using var factory = new ShellTestFactory(new StubPublicContentReader("Sample Shop"), new ApprovedLegalPages("/privacy", "/terms", "/accessibility", "/cookies"));
        using var client = factory.CreateClient();

        var body = await client.GetStringAsync(new Uri("/sitemap.xml", UriKind.Relative), TestContext.Current.CancellationToken);

        body.ShouldNotContain($"{Origin}/cookies", Case.Sensitive);
    }

    [Fact]
    public async Task AnApprovedLegalPageIsListedAndTheOtherDraftsStayOut()
    {
        await using var factory = new ShellTestFactory(new StubPublicContentReader("Sample Shop"), new ApprovedLegalPages("/terms"));
        using var client = factory.CreateClient();

        var document = XDocument.Parse(await client.GetStringAsync(new Uri("/sitemap.xml", UriKind.Relative), TestContext.Current.CancellationToken));

        XNamespace ns = "http://www.sitemaps.org/schemas/sitemap/0.9";
        document.Root.ShouldNotBeNull().Elements(ns + "url").Select(url => url.Element(ns + "loc")!.Value).ShouldBe(
            [$"{Origin}/", $"{Origin}/products", $"{Origin}/gallery", $"{Origin}/contact", $"{Origin}/terms"]);
    }

    // Each URL has the UTC date of the newest content change; a legal page has the later of that and its own text date.
    // The literal legal dates are LegalPages' LastUpdated values: a change to those facts must show up as an edit here.
    [Fact]
    public async Task ALegalPageWhoseTextChangedAfterTheContentHasItsOwnDate()
    {
        var lastChanged = new DateTimeOffset(2026, 11, 1, 8, 0, 0, TimeSpan.Zero);
        await using var factory = new ShellTestFactory(new StubPublicContentReader(StubPublicContentReader.Site("Sample Shop"), lastChanged));
        using var client = factory.CreateClient();

        var document = XDocument.Parse(await client.GetStringAsync(new Uri("/sitemap.xml", UriKind.Relative), TestContext.Current.CancellationToken));

        XNamespace ns = "http://www.sitemaps.org/schemas/sitemap/0.9";
        document.Root.ShouldNotBeNull().Elements(ns + "url").Select(url => url.Element(ns + "lastmod")?.Value).ShouldBe(
            ["2026-11-01", "2026-11-01", "2026-11-01", "2026-11-01", "2026-11-25", "2026-11-18", "2026-11-18"]);
    }

    [Fact]
    public async Task ALegalPageTakesTheContentDateWhenTheContentChangedLater()
    {
        var lastChanged = new DateTimeOffset(2026, 12, 31, 8, 0, 0, TimeSpan.Zero);
        await using var factory = new ShellTestFactory(new StubPublicContentReader(StubPublicContentReader.Site("Sample Shop"), lastChanged));
        using var client = factory.CreateClient();

        var document = XDocument.Parse(await client.GetStringAsync(new Uri("/sitemap.xml", UriKind.Relative), TestContext.Current.CancellationToken));

        XNamespace ns = "http://www.sitemaps.org/schemas/sitemap/0.9";
        document.Root.ShouldNotBeNull().Elements(ns + "url").Select(url => url.Element(ns + "lastmod")?.Value).ShouldBe(
            Enumerable.Repeat("2026-12-31", DefaultSitemapLocs.Length));
    }

    [Fact]
    public async Task WhenTheContentCannotBeReadTheSitemapIsStillSentWithoutDates()
    {
        await using var factory = new ShellTestFactory(new StubPublicContentReader(new InvalidOperationException("content is down")));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/sitemap.xml", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var document = XDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        XNamespace ns = "http://www.sitemaps.org/schemas/sitemap/0.9";
        document.Root.ShouldNotBeNull().Elements(ns + "url").Count().ShouldBe(DefaultSitemapLocs.Length);
        document.Descendants(ns + "lastmod").ShouldBeEmpty();
    }

    [Fact]
    public async Task TheGpcStatementSaysTheSiteHonorsTheSignalAsJson()
    {
        await using var factory = new ShellTestFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/.well-known/gpc.json", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("application/json");
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBe("{\"gpc\":true,\"lastUpdate\":\"2026-11-15\"}");
    }

    [Fact]
    public async Task TheGpcStatementHeadGetsTheHeadersWithNoBody()
    {
        await using var factory = new ShellTestFactory();
        using var client = factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Head, "/.well-known/gpc.json");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("application/json");
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty();
    }

    [Fact]
    public async Task TheGpcStatementMustBeRevalidatedByCaches()
    {
        await using var factory = new ShellTestFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/.well-known/gpc.json", UriKind.Relative), TestContext.Current.CancellationToken);

        response.Headers.CacheControl.ShouldNotBeNull().NoCache.ShouldBeTrue();
    }

    [Theory]
    [InlineData("/robots.txt")]
    [InlineData("/sitemap.xml")]
    public async Task AForgedHostHeaderChangesNothing(string path)
    {
        await using var factory = new ShellTestFactory();
        using var client = factory.CreateClient();
        using var honest = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);
        using var request = ApiRequests.Get(path);
        request.Headers.Host = "evil.example";

        using var forged = await client.SendAsync(request, TestContext.Current.CancellationToken);

        forged.StatusCode.ShouldBe(HttpStatusCode.OK, path);
        var body = await forged.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldNotContain("evil.example", Case.Insensitive, path);
        body.ShouldBe(await honest.Content.ReadAsStringAsync(TestContext.Current.CancellationToken), path);
    }

    [Theory]
    [InlineData("/robots.txt")]
    [InlineData("/sitemap.xml")]
    public async Task HeadGetsTheHeadersWithNoBody(string path)
    {
        await using var factory = new ShellTestFactory();
        using var client = factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Head, path);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, path);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty(path);
    }

    [Theory]
    [InlineData("/robots.txt")]
    [InlineData("/sitemap.xml")]
    public async Task BothRevalidateOnEveryUse(string path)
    {
        await using var factory = new ShellTestFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        response.Headers.CacheControl.ShouldNotBeNull(path).NoCache.ShouldBeTrue(path);
    }
}
