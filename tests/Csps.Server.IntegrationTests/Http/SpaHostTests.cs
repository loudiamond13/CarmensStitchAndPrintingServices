using System.Net;
using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// WEB-01, FND-05: the API host serves the built React shell anonymously from its web root at any non-file path,
/// under the strict CSP, while unknown <c>/api</c> paths keep answering a ProblemDetails 404. The suite runs against
/// the committed fixture web root (<see cref="CspsApiFactory.FixtureWebRoot"/>), never a local <c>npm run build</c>.
/// Build internals in dot folders, such as Vite's <c>.vite/license.md</c>, are never served (G-02-2).
/// </summary>
public sealed class SpaHostTests
{
    private const string FixtureShellMarker = "CSPS fixture shell";
    private const string FixtureHiddenMarker = "CSPS fixture build internal";
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
    public async Task UnknownApiRouteIsStillProblem404()
    {
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/api/v1/does-not-exist", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe(ProblemJson.MediaType);
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
    }

    [Theory]
    // G-02-2: a typed file inside a dot folder (Vite's build.license output), in any case. System.Uri decodes %2E
    // before sending, so the encoded row equals the plain one in memory; the real-host check covers Kestrel's decoding.
    [InlineData("/.vite/license.md", ".vite/license.md")]
    [InlineData("/.VITE/LICENSE.MD", ".vite/license.md")]
    [InlineData("/%2Evite/license.md", ".vite/license.md")]
    // A file nested in any generic dot folder, not only .vite.
    [InlineData("/.x/y.txt", ".x/y.txt")]
    // Windows path equivalences (CWE-41, CWE-58): a backslash is a separator, and NTFS 8.3 short names alias .vite as
    // VITE~1. Both pass trivially on Linux, where the HiddenSegmentFileProviderTests truth table pins the rule.
    [InlineData("/assets%5C..%5C.vite%5Clicense.md", ".vite/license.md")]
    [InlineData("/VITE~1/license.md", ".vite/license.md")]
    public async Task HiddenFilesAreProblem404(string path, string fixtureFile)
    {
        // Non-vacuous guard: the fixture's dot folder really is in the served web root.
        File.Exists(Path.Combine(CspsApiFactory.FixtureWebRoot, fixtureFile)).ShouldBeTrue($"fixture {fixtureFile} missing from the test output");
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();
        using var missing = await client.GetAsync(new Uri("/missing.js", UriKind.Relative), TestContext.Current.CancellationToken);
        var missingProblem = await ProblemJson.ReadAsync(missing, TestContext.Current.CancellationToken);

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound, path);
        response.Content.Headers.ContentType.ShouldNotBeNull(path).MediaType.ShouldBe(ProblemJson.MediaType, path);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldNotContain(FixtureHiddenMarker, Case.Sensitive, path);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);

        // A hidden file is indistinguishable from a missing one (CWE-204), and no file metadata leaks.
        problem.GetProperty("title").GetString().ShouldBe(missingProblem.GetProperty("title").GetString(), path);
        response.Headers.ETag.ShouldBeNull(path);
        response.Content.Headers.LastModified.ShouldBeNull(path);
    }

    [Fact]
    public async Task HeadOnAHiddenFileIs404WithoutFileMetadata()
    {
        // G-02-2: HEAD must not reveal a hidden file's size or date either.
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Head, "/.vite/license.md");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        response.Headers.ETag.ShouldBeNull();
        response.Content.Headers.LastModified.ShouldBeNull();
        response.Headers.AcceptRanges.ShouldBeEmpty();
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
    [InlineData("/openapi/v1.json")]
    [InlineData("/openapi/")]
    [InlineData("/scalar")]
    [InlineData("/scalar/")]
    [InlineData("/scalar/x")]
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
        // PERF-02: html, css, js and svg go out compressed when the browser accepts it (research Pitfall 3).
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(path, UriKind.Relative));
        request.Headers.TryAddWithoutValidation("Accept-Encoding", AcceptEncoding);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, path);
        response.Content.Headers.ContentEncoding.ShouldHaveSingleItem(path).ShouldBeOneOf("br", "gzip");
    }

    [Theory]
    [InlineData("/health")]
    [InlineData("/api/v1/does-not-exist")]
    public async Task NeverCompressesJson(string path)
    {
        // BREACH (research Pitfall 3): JSON and ProblemDetails are never compressed, even when the client asks.
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(path, UriKind.Relative));
        request.Headers.TryAddWithoutValidation("Accept-Encoding", AcceptEncoding);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.Content.Headers.ContentEncoding.ShouldBeEmpty(path);
    }

    [Fact]
    public async Task AssetsAreImmutable()
    {
        // Vite gives every file under /assets a content hash, so a year-long immutable cache is safe (T-02-05).
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/assets/app-fixture.js", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        RawCacheControl(response).ShouldBe("public, max-age=31536000, immutable");
    }

    [Theory]
    [InlineData("/robots.txt")]
    [InlineData("/")]
    public async Task OtherStaticFilesRevalidate(string path)
    {
        // Files without a content hash (the shell, robots.txt, mark.svg) are revalidated on every use (T-02-05).
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, path);
        RawCacheControl(response).ShouldBe("no-cache", path);
    }

    private static string RawCacheControl(HttpResponseMessage response) =>
        response.Headers.NonValidated.TryGetValues("Cache-Control", out var values) ? values.ToString() : string.Empty;
}
