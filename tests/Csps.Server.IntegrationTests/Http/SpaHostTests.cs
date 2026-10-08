using System.Net;
using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// WEB-01, FND-05: the API host serves the React shell anonymously from its web root at any non-file path, under the
/// strict CSP and with <c>Cache-Control: no-cache</c>, while unknown <c>/api</c> paths keep answering a ProblemDetails
/// 404. The suite runs against the committed fixture web root (<c>tests/Csps.Testing/Fixtures/webroot</c>), never a
/// local <c>npm run build</c>.
/// </summary>
public sealed class SpaHostTests
{
    private const string FixtureShellMarker = "CSPS fixture shell";
    private const string AcceptEncoding = "br, gzip";

    [Theory]
    [InlineData("/")]
    [InlineData("/products")]
    [InlineData("/admin/orders")]
    public async Task NonFilePathsServeTheShell(string path)
    {
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, path);
        response.Content.Headers.ContentType.ShouldNotBeNull(path).MediaType.ShouldBe("text/html", path);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldContain(FixtureShellMarker, Case.Sensitive, path);
        response.Headers.CacheControl.ShouldNotBeNull(path).NoCache.ShouldBeTrue(path);
        SecurityHeadersTests.Single(response, SecurityHeadersTests.CspHeader).ShouldBe(SecurityHeadersTests.StrictCsp, path);
    }

    [Fact]
    public async Task HeadServesTheShell()
    {
        // MapFallbackToFile registers GET and HEAD, so a HEAD on a page path gets the shell's headers without a body.
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Head, "/products");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("text/html");
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldBeEmpty();
    }

    [Fact]
    public async Task UnknownApiRouteIsStillProblem404()
    {
        // The literal /api/{**path} fallback outranks the shell's catch-all, so the shell never swallows the API (FND-05).
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/api/v1/nope", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe(ProblemJson.MediaType);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ProblemJson.TraceId(problem);
    }

    [Fact]
    public async Task ExistingFileIsServed()
    {
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/assets/app-fixture.js", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("text/javascript");
    }

    [Theory]
    [InlineData("GET", "/missing.js")]
    [InlineData("GET", "/assets/missing.js")]
    [InlineData("GET", "/favicon.ico")]
    [InlineData("POST", "/missing.js")]
    [InlineData("POST", "/assets/missing.js")]
    [InlineData("POST", "/favicon.ico")]
    public async Task MissingFileIsProblem404(string method, string path)
    {
        // Pitfall 11: a file-like path is never the shell, and a missing file is a plain 404 for everyone, never 401.
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();
        using var request = ApiRequests.Create(new HttpMethod(method), path);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound, $"{method} {path}");
        response.Content.Headers.ContentType.ShouldNotBeNull(path).MediaType.ShouldBe(ProblemJson.MediaType, path);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ProblemJson.TraceId(problem);
    }

    [Theory]
    [InlineData("/openapi/v1.json")]
    [InlineData("/scalar")]
    [InlineData("/scalar/")]
    [InlineData("/scalar/foo")]
    public async Task ReservedDocsPathsAre404OutsideDevelopment(string path)
    {
        // D-29: outside Development the API-doc prefixes stay reserved for the server; they never show the shell.
        await using var baseFactory = new CspsApiFactory();
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseEnvironment(Environments.Production));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound, path);
        response.Content.Headers.ContentType.ShouldNotBeNull(path).MediaType.ShouldBe(ProblemJson.MediaType, path);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldNotContain(FixtureShellMarker, Case.Sensitive, path);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/assets/app-fixture.js")]
    public async Task CompressesStaticText(string path)
    {
        // PERF-02, research Pitfall 3: html, css, js and svg go out Brotli-compressed when the browser accepts it.
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Get, path);
        request.Headers.TryAddWithoutValidation("Accept-Encoding", AcceptEncoding);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, path);
        response.Content.Headers.ContentEncoding.ShouldHaveSingleItem(path).ShouldBe("br", path);
    }

    [Theory]
    [InlineData("/health")]
    [InlineData("/api/v1/nope")]
    public async Task NeverCompressesJson(string path)
    {
        // BREACH (research Pitfall 3): JSON and ProblemDetails are never compressed, even when the client asks.
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Get, path);
        request.Headers.TryAddWithoutValidation("Accept-Encoding", AcceptEncoding);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.Content.Headers.ContentType.ShouldNotBeNull(path).MediaType.ShouldNotBeNull(path).ShouldContain("json", Case.Sensitive, path);
        response.Content.Headers.ContentEncoding.ShouldBeEmpty(path);
    }

    [Fact]
    public async Task AssetsAreImmutable()
    {
        // Vite content-hashes every file under /assets, so a year-long immutable cache is safe (T-02-10).
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/assets/app-fixture.js", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        RawCacheControl(response).ShouldBe("public, max-age=31536000, immutable");
    }

    [Theory]
    [InlineData("/robots.txt")]
    [InlineData("/index.html")]
    [InlineData("/")]
    public async Task OtherStaticFilesRevalidate(string path)
    {
        // Files without a content hash (the shell, robots.txt) are revalidated on every use, so a deploy is seen at once
        // (T-02-10).
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, path);
        RawCacheControl(response).ShouldBe("no-cache", path);
    }

    private static string RawCacheControl(HttpResponseMessage response) =>
        response.Headers.NonValidated.TryGetValues("Cache-Control", out var values) ? values.ToString() : string.Empty;
}
