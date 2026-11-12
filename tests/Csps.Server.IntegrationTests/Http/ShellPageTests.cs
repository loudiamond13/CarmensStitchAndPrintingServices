using System.Net;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using Serilog.Events;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// PUB-04, PUB-01: the server sends each public page's own head and its real status in the first response, before any
/// script runs. Unknown paths are real 404s, admin paths are noindex, and every address comes from App:PublicBaseUrl.
/// The suite runs against the committed fixture web root.
/// </summary>
public sealed partial class ShellPageTests
{
    private const string Origin = "https://localhost";
    private const string FixtureShellMarker = "CSPS fixture shell";
    private const string NoIndex = "noindex, nofollow";
    private const string TestBusinessName = ShellTestFactory.DefaultBusinessName;

    [Theory]
    [InlineData("/", "CSPS · Custom Team Jerseys and Tailoring", "Custom tailoring and full-sublimation printing for teams, leagues and riding groups.", "/")]
    [InlineData("/products", "Products and Prices · CSPS", "See our product lines, starting prices and everything you can customize, from fabric to names and numbers.", "/products")]
    [InlineData("/gallery", "Our Work · Gallery · CSPS", "Photos of real team orders from leagues, schools, riding clubs and offices.", "/gallery")]
    [InlineData("/contact", "Contact Us and Get a Quote · CSPS", "Message us on Messenger or call the shop. See our hours, address and map.", "/contact")]
    public async Task PublicPageGetsItsOwnHead(string path, string title, string description, string canonicalPath)
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, path);
        response.Content.Headers.ContentType.ShouldNotBeNull(path).MediaType.ShouldBe("text/html", path);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldContain($"<title>{title}</title>", Case.Sensitive, path);
        body.ShouldContain(FixtureShellMarker, Case.Sensitive, path);
        var canonical = Origin + canonicalPath;
        Meta(body, "name", "description").ShouldBe(description, path);
        Link(body, "canonical").ShouldBe(canonical, path);
        Meta(body, "property", "og:type").ShouldBe("website", path);
        Meta(body, "property", "og:site_name").ShouldBe(TestBusinessName, path);
        Meta(body, "property", "og:locale").ShouldBe("en_PH", path);
        Meta(body, "property", "og:title").ShouldBe(title, path);
        Meta(body, "property", "og:description").ShouldBe(description, path);
        Meta(body, "property", "og:url").ShouldBe(canonical, path);
        Meta(body, "name", "robots").ShouldBeNull(path);
        body.ShouldNotContain("csps:head", Case.Sensitive, path);
        response.Headers.Contains("X-Robots-Tag").ShouldBeFalse(path);
    }

    [Theory]
    [InlineData("/nope")]
    [InlineData("/products/old")]
    [InlineData("/products//")]
    [InlineData("/administrator")]
    public async Task UnknownPathIsARealNotFoundWithTheShell(string path)
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound, path);
        response.Content.Headers.ContentType.ShouldNotBeNull(path).MediaType.ShouldBe("text/html", path);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldContain("<div id=\"root\">", Case.Sensitive, path);
        body.ShouldContain("<title>Page Not Found · CSPS</title>", Case.Sensitive, path);
        Meta(body, "name", "description").ShouldBe("This page couldn't be found.", path);
        Meta(body, "name", "robots").ShouldBe(NoIndex, path);
        Link(body, "canonical").ShouldBeNull(path);
        Meta(body, "property", "og:url").ShouldBeNull(path);
    }

    [Fact]
    public async Task UnknownApiPathStaysProblemDetails()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/api/v1/nope", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe(ProblemJson.MediaType);
    }

    [Theory]
    [InlineData("/Products")]
    [InlineData("/products/")]
    [InlineData("/PRODUCTS/")]
    public async Task CaseAndOneTrailingSlashMatchTheSamePage(string path)
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, path);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldContain("<title>Products and Prices · CSPS</title>", Case.Sensitive, path);
        Link(body, "canonical").ShouldBe(Origin + "/products", path);
        Meta(body, "property", "og:url").ShouldBe(Origin + "/products", path);
    }

    [Theory]
    [InlineData("/admin")]
    [InlineData("/admin/")]
    [InlineData("/admin/orders")]
    [InlineData("/Admin/Site-Content")]
    public async Task AdminPathsAreNoIndex(string path)
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, path);
        response.Headers.GetValues("X-Robots-Tag").ShouldHaveSingleItem(path).ShouldBe(NoIndex, path);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldContain(FixtureShellMarker, Case.Sensitive, path);
        Meta(body, "name", "robots").ShouldBe(NoIndex, path);
    }

    [Fact]
    public async Task DevPathsAreKnownInTheTestingEnvironment()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/dev/components", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldContain(FixtureShellMarker, Case.Sensitive);
    }

    [Theory]
    [InlineData("/dev")]
    [InlineData("/dev/components")]
    public async Task DevPathsAreNotFoundInProduction(string path)
    {
        await using var baseFactory = Factory();
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseEnvironment(Environments.Production));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound, path);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldContain("<title>Page Not Found · CSPS</title>", Case.Sensitive, path);
    }

    [Fact]
    public async Task ForgedHostHeaderChangesNoAddress()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get("/products");
        request.Headers.Host = "evil.example";

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Link(body, "canonical").ShouldBe(Origin + "/products");
        Meta(body, "property", "og:url").ShouldBe(Origin + "/products");
        body.ShouldNotContain("evil.example", Case.Insensitive);
    }

    [Fact]
    public async Task RequestTextIsNeverEchoedIntoTheHtml()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(
            new Uri("/x%22%20onmouseover%3Dalert(1)%20y%3D%22%3Cscript%3E", UriKind.Relative),
            TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldNotContain("onmouseover", Case.Insensitive);
        body.ShouldNotContain("alert(1)", Case.Insensitive);
    }

    [Fact]
    public async Task BusinessNameIsHtmlEncodedInTheHead()
    {
        await using var factory = new ShellTestFactory(new StubSiteSettingsReader("A<b>\"x\"&</b>"));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/products", UriKind.Relative), TestContext.Current.CancellationToken);

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldContain("property=\"og:site_name\" content=\"A&lt;b&gt;&quot;x&quot;&amp;&lt;/b&gt;\"", Case.Sensitive);
        body.ShouldNotContain("<b>", Case.Sensitive);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/products")]
    [InlineData("/admin/orders")]
    [InlineData("/nope")]
    public async Task HeadGetsTheStatusAndHeadersWithNoBody(string path)
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        using var getResponse = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);
        using var request = ApiRequests.Create(HttpMethod.Head, path);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(getResponse.StatusCode, path);
        response.Content.Headers.ContentType.ShouldNotBeNull(path).MediaType.ShouldBe("text/html", path);
        response.Headers.ETag.ShouldBe(getResponse.Headers.ETag, path);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty(path);
    }

    [Theory]
    [InlineData("POST")]
    [InlineData("PUT")]
    [InlineData("DELETE")]
    public async Task WritesOnAPagePathMeetDefaultDeny(string method)
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        using var request = ApiRequests.Create(new HttpMethod(method), "/products");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized, method);
    }

    [Fact]
    public async Task ShellSendsNoCacheAndAWeakETagAndAnswers304ToAMatch()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        using var first = await client.GetAsync(new Uri("/products", UriKind.Relative), TestContext.Current.CancellationToken);

        first.Headers.CacheControl.ShouldNotBeNull().NoCache.ShouldBeTrue();
        var etag = first.Headers.ETag.ShouldNotBeNull();
        etag.IsWeak.ShouldBeTrue();
        using var request = ApiRequests.Get("/products");
        request.Headers.TryAddWithoutValidation("If-None-Match", etag.ToString());

        using var second = await client.SendAsync(request, TestContext.Current.CancellationToken);

        second.StatusCode.ShouldBe(HttpStatusCode.NotModified);
        (await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty();
    }

    [Fact]
    public async Task ANonMatchingETagGetsTheFullPage()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get("/products");
        request.Headers.TryAddWithoutValidation("If-None-Match", "W/\"not-this-one\"");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task EachPageHasItsOwnETag()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        using var products = await client.GetAsync(new Uri("/products", UriKind.Relative), TestContext.Current.CancellationToken);
        using var gallery = await client.GetAsync(new Uri("/gallery", UriKind.Relative), TestContext.Current.CancellationToken);

        products.Headers.ETag.ShouldNotBe(gallery.Headers.ETag);
    }

    [Fact]
    public async Task IndexHtmlIsNeverServedAsARawFile()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/index.html", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldNotContain("csps:head", Case.Sensitive);
        body.ShouldNotContain(FixtureShellMarker, Case.Sensitive);
    }

    [Fact]
    public async Task ASettingsFailureSendsThePlainTemplateHeadWithTheSameStatusRulesAndLogsOnce()
    {
        await using var factory = new ShellTestFactory(new StubSiteSettingsReader(new InvalidOperationException("settings are down")));
        using var client = factory.CreateClient();

        using var first = await client.GetAsync(new Uri("/products", UriKind.Relative), TestContext.Current.CancellationToken);
        using var second = await client.GetAsync(new Uri("/products", UriKind.Relative), TestContext.Current.CancellationToken);
        using var missing = await client.GetAsync(new Uri("/nope", UriKind.Relative), TestContext.Current.CancellationToken);

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        missing.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var body = await first.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldContain("<title>CSPS fixture</title>", Case.Sensitive);
        body.ShouldContain(FixtureShellMarker, Case.Sensitive);
        body.ShouldNotContain("csps:head", Case.Sensitive);
        Link(body, "canonical").ShouldBeNull();
        factory.Sink.Events
            .Count(logEvent => logEvent.Level == LogEventLevel.Warning && logEvent.MessageTemplate.Text.Contains("shell", StringComparison.OrdinalIgnoreCase))
            .ShouldBe(1);
    }

    private static ShellTestFactory Factory() => new();

    private static string? Meta(string html, string attribute, string key)
    {
        var match = MetaTag().Matches(html)
            .Select(m => m.Value)
            .FirstOrDefault(tag => tag.Contains($"{attribute}=\"{key}\"", StringComparison.Ordinal));
        return match is null ? null : Content(match);
    }

    private static string? Link(string html, string rel)
    {
        var match = LinkTag().Matches(html)
            .Select(m => m.Value)
            .FirstOrDefault(tag => tag.Contains($"rel=\"{rel}\"", StringComparison.Ordinal));
        if (match is null)
        {
            return null;
        }

        var href = Href().Match(match);
        return href.Success ? WebUtility.HtmlDecode(href.Groups[1].Value) : null;
    }

    private static string? Content(string tag)
    {
        var content = ContentAttribute().Match(tag);
        return content.Success ? WebUtility.HtmlDecode(content.Groups[1].Value) : null;
    }

    [GeneratedRegex("<meta\\b[^>]*>", RegexOptions.CultureInvariant)]
    private static partial Regex MetaTag();

    [GeneratedRegex("<link\\b[^>]*>", RegexOptions.CultureInvariant)]
    private static partial Regex LinkTag();

    [GeneratedRegex("\\scontent=\"([^\"]*)\"", RegexOptions.CultureInvariant)]
    private static partial Regex ContentAttribute();

    [GeneratedRegex("\\shref=\"([^\"]*)\"", RegexOptions.CultureInvariant)]
    private static partial Regex Href();
}
