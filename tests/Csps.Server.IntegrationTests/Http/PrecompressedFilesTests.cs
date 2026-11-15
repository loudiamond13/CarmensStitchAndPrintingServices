using System.IO.Compression;
using System.Net;
using System.Text;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// D-28, D-46, T-11-87, T-11-88: a browser that accepts Brotli gets the build-time <c>.br</c> twin of a static asset, with the
/// original type and cache headers; every other client, link-preview crawlers included, never gets a <c>.br</c> body. The suite
/// runs against the committed fixture web root: <c>assets/precompressed-sample.js</c> has a <c>.br</c> twin made at a different
/// quality than the host's own compressor, so its bytes prove which file was sent; <c>assets/app-fixture.js</c> has none.
/// </summary>
public sealed class PrecompressedFilesTests
{
    private const string SamplePath = "/assets/precompressed-sample.js";
    private const string SampleMarker = "CSPS precompressed fixture: the plain file";

    private static byte[] FixtureBytes(string name) => File.ReadAllBytes(Path.Combine(CspsApiFactory.FixtureWebRoot, "assets", name));

    private static async Task<Fetched> GetAsync(HttpMethod method, string path, string? acceptEncoding, string? ifNoneMatch = null)
    {
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();
        using var request = ApiRequests.Create(method, path);
        if (acceptEncoding is not null)
        {
            request.Headers.TryAddWithoutValidation("Accept-Encoding", acceptEncoding);
        }

        if (ifNoneMatch is not null)
        {
            request.Headers.TryAddWithoutValidation("If-None-Match", ifNoneMatch);
        }

        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        var body = await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        return new Fetched(response, body);
    }

    private static void ShouldVaryOnAcceptEncoding(HttpResponseMessage response, string label) =>
        response.Headers.Vary.Count(value => string.Equals(value, "Accept-Encoding", StringComparison.OrdinalIgnoreCase))
            .ShouldBe(1, $"Vary: Accept-Encoding for {label}");

    [Theory]
    [InlineData("br, gzip")]
    [InlineData("gzip, deflate, br")]
    [InlineData("BR")]
    [InlineData("gzip;q=0.5, br;q=1.0")]
    public async Task ABrowserThatAcceptsBrotliGetsTheBrFile(string acceptEncoding)
    {
        using var fetched = await GetAsync(HttpMethod.Get, SamplePath, acceptEncoding);

        fetched.Response.StatusCode.ShouldBe(HttpStatusCode.OK, acceptEncoding);
        fetched.Response.Content.Headers.ContentEncoding.ShouldHaveSingleItem(acceptEncoding).ShouldBe("br", acceptEncoding);
        fetched.Response.Content.Headers.ContentType.ShouldNotBeNull(acceptEncoding).MediaType.ShouldBe("text/javascript", acceptEncoding);
        ShouldVaryOnAcceptEncoding(fetched.Response, acceptEncoding);
        fetched.Body.ShouldBe(FixtureBytes("precompressed-sample.js.br"), "the body is the .br file, not a fresh compression");
        fetched.Decoded().ShouldContain(SampleMarker, Case.Sensitive, "compressed once, not twice");
    }

    [Fact]
    public async Task TheBrResponseKeepsTheLengthTheImmutableCacheHeaderAndItsOwnEntityTag()
    {
        using var brotli = await GetAsync(HttpMethod.Get, SamplePath, "br");
        using var plain = await GetAsync(HttpMethod.Get, SamplePath, "identity");

        brotli.Response.Content.Headers.ContentLength.ShouldBe(brotli.Body.Length);
        brotli.Response.Headers.NonValidated.TryGetValues("Cache-Control", out var cache).ShouldBeTrue();
        cache.ToString().ShouldBe("public, max-age=31536000, immutable");
        var brotliTag = brotli.Response.Headers.ETag.ShouldNotBeNull().Tag;
        var plainTag = plain.Response.Headers.ETag.ShouldNotBeNull().Tag;
        brotliTag.ShouldNotBe(plainTag, "the two bodies are different representations");
    }

    [Fact]
    public async Task ARevalidationOfTheBrResponseAnswers304()
    {
        using var first = await GetAsync(HttpMethod.Get, SamplePath, "br");
        var tag = first.Response.Headers.ETag.ShouldNotBeNull().Tag;

        using var second = await GetAsync(HttpMethod.Get, SamplePath, "br", tag);

        second.Response.StatusCode.ShouldBe(HttpStatusCode.NotModified);
        second.Body.ShouldBeEmpty();
    }

    [Theory]
    [InlineData("gzip, deflate")]
    [InlineData("deflate, gzip")]
    [InlineData("gzip")]
    [InlineData("identity")]
    [InlineData("br;q=0, gzip")]
    [InlineData("br;q=0")]
    [InlineData("")]
    [InlineData(null)]
    public async Task AClientWithoutBrotliNeverGetsTheBrFile(string? acceptEncoding)
    {
        var label = acceptEncoding ?? "(no header)";
        using var fetched = await GetAsync(HttpMethod.Get, SamplePath, acceptEncoding);

        fetched.Response.StatusCode.ShouldBe(HttpStatusCode.OK, label);
        fetched.Response.Content.Headers.ContentEncoding.ShouldNotContain("br", label);
        fetched.Body.ShouldNotBe(FixtureBytes("precompressed-sample.js.br"), label);
        fetched.Decoded().ShouldContain(SampleMarker, Case.Sensitive, label);
        fetched.Response.Content.Headers.ContentType.ShouldNotBeNull(label).MediaType.ShouldBe("text/javascript", label);
        ShouldVaryOnAcceptEncoding(fetched.Response, label);
    }

    [Fact]
    public async Task AWildcardAloneDoesNotSelectTheBrFile()
    {
        // Only an explicit "br" picks the precompressed file; the host's own compressor may still answer a wildcard.
        using var fetched = await GetAsync(HttpMethod.Get, SamplePath, "*");

        fetched.Response.StatusCode.ShouldBe(HttpStatusCode.OK);
        fetched.Body.ShouldNotBe(FixtureBytes("precompressed-sample.js.br"));
        fetched.Decoded().ShouldContain(SampleMarker, Case.Sensitive);
        ShouldVaryOnAcceptEncoding(fetched.Response, "*");
    }

    [Fact]
    public async Task AnAssetWithoutABrFileFallsBackToTheFile()
    {
        using var fetched = await GetAsync(HttpMethod.Get, "/assets/app-fixture.js", "br, gzip");

        fetched.Response.StatusCode.ShouldBe(HttpStatusCode.OK);
        fetched.Response.Content.Headers.ContentEncoding.ShouldHaveSingleItem().ShouldBe("br");
        fetched.Decoded().ShouldBe(Encoding.UTF8.GetString(FixtureBytes("app-fixture.js")));
    }

    [Fact]
    public async Task HeadForTheBrFileSendsTheBrHeadersWithoutABody()
    {
        using var fetched = await GetAsync(HttpMethod.Head, SamplePath, "br");

        fetched.Response.StatusCode.ShouldBe(HttpStatusCode.OK);
        fetched.Response.Content.Headers.ContentEncoding.ShouldHaveSingleItem().ShouldBe("br");
        fetched.Response.Content.Headers.ContentLength.ShouldBe(FixtureBytes("precompressed-sample.js.br").Length);
        fetched.Body.ShouldBeEmpty();
    }

    [Theory]
    [InlineData("/assets/precompressed-sample.js.br")]
    [InlineData("/assets/precompressed-sample.js.br.br")]
    [InlineData("/assets/app-fixture.js.br")]
    public async Task ABrFileIsNeverServedByItsOwnAddress(string path)
    {
        using var fetched = await GetAsync(HttpMethod.Get, path, "br, gzip");

        fetched.Response.StatusCode.ShouldBe(HttpStatusCode.NotFound, path);
        fetched.Response.Content.Headers.ContentType.ShouldNotBeNull(path).MediaType.ShouldBe(ProblemJson.MediaType, path);
    }

    [Fact]
    public async Task TheShellPageIsNeverServedFromABrFile()
    {
        using var fetched = await GetAsync(HttpMethod.Get, "/", "br, gzip");

        fetched.Response.StatusCode.ShouldBe(HttpStatusCode.OK);
        fetched.Response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("text/html");
        fetched.Decoded().ShouldContain("CSPS fixture shell", Case.Sensitive);
    }

    [Theory]
    [InlineData("/health")]
    [InlineData("/api/v1/nope")]
    public async Task JsonIsNeverPrecompressedOrCompressed(string path)
    {
        // T-11-88, BREACH (D-43): only static .js, .css and .svg ever get a .br file.
        using var fetched = await GetAsync(HttpMethod.Get, path, "br, gzip");

        fetched.Response.Content.Headers.ContentEncoding.ShouldBeEmpty(path);
    }

    private sealed class Fetched(HttpResponseMessage response, byte[] body) : IDisposable
    {
        public HttpResponseMessage Response { get; } = response;

        public byte[] Body { get; } = body;

        /// <summary>The body with its one Content-Encoding (none, gzip or br) removed.</summary>
        public string Decoded()
        {
            var encoding = Response.Content.Headers.ContentEncoding.SingleOrDefault();
            if (encoding is null)
            {
                return Encoding.UTF8.GetString(Body);
            }

            using var input = new MemoryStream(Body);
            using Stream decoder = encoding switch
            {
                "br" => new BrotliStream(input, CompressionMode.Decompress),
                "gzip" => new GZipStream(input, CompressionMode.Decompress),
                _ => throw new InvalidOperationException($"Unexpected Content-Encoding {encoding}."),
            };
            using var output = new MemoryStream();
            decoder.CopyTo(output);
            return Encoding.UTF8.GetString(output.ToArray());
        }

        public void Dispose() => Response.Dispose();
    }
}
