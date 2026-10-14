using System.Net;
using System.Text.RegularExpressions;
using Csps.Server.Endpoints;
using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// D-14: OpenAPI and the Scalar viewer exist only in Development, and only Scalar gets the nonce carve-out CSP.
/// </summary>
public sealed partial class OpenApiExposureTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly string[] DocsPrefixes = ["openapi", "scalar"];

    [Fact]
    public async Task DevelopmentServesOpenApiAndScalar()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseEnvironment(Environments.Development));
        using var client = factory.CreateClient();

        using var openApi = await client.GetAsync(new Uri("/openapi/v1.json", UriKind.Relative), TestContext.Current.CancellationToken);
        openApi.StatusCode.ShouldBe(HttpStatusCode.OK);
        openApi.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("application/json");
        SecurityHeadersTests.Single(openApi, SecurityHeadersTests.CspHeader).ShouldBe(SecurityHeadersTests.StrictCsp);

        using var scalar = await client.GetAsync(new Uri("/scalar", UriKind.Relative), TestContext.Current.CancellationToken);
        scalar.StatusCode.ShouldBe(HttpStatusCode.OK);
        scalar.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("text/html");
        var html = await scalar.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var nonces = NonceAttribute().Matches(html).Select(match => match.Groups["nonce"].Value).Distinct(StringComparer.Ordinal).ToList();
        var nonce = nonces.ShouldHaveSingleItem();
        nonce.ShouldNotBeNullOrWhiteSpace();
        InlineScriptTag().Count(html).ShouldBeGreaterThan(0);
        InlineScriptTag().Matches(html).ShouldAllBe(tag => tag.Value.Contains($"nonce=\"{nonce}\"", StringComparison.Ordinal));
        var csp = SecurityHeadersTests.Single(scalar, SecurityHeadersTests.CspHeader);
        csp.ShouldContain($"script-src 'self' 'nonce-{nonce}'", Case.Sensitive);
        csp.ShouldContain("frame-ancestors 'none'", Case.Sensitive);
        csp.ShouldNotContain("unsafe-eval", Case.Sensitive);

        using var health = await client.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);
        SecurityHeadersTests.Single(health, SecurityHeadersTests.CspHeader).ShouldBe(SecurityHeadersTests.StrictCsp);
    }

    [Fact]
    public async Task DevelopmentMapsTheDocsRoutes()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseEnvironment(Environments.Development));

        DocsRoutes(factory.Services).ShouldNotBeEmpty();
    }

    [Fact]
    public async Task ProductionHasNoApiDocs()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseEnvironment(Environments.Production));
        using var client = factory.CreateClient();

        DocsRoutes(factory.Services).ShouldBeEmpty();
        foreach (var path in new[] { "/openapi/v1.json", "/scalar", "/scalar/" })
        {
            // A 404 exactly, from the reserved-prefix fallback, never the SPA shell's 200 (D-29, research Pitfall 12).
            using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.NotFound, path);
            response.Content.Headers.ContentType.ShouldNotBeNull(path).MediaType.ShouldBe(ProblemJson.MediaType);
        }
    }

    [Fact]
    public async Task ProductionMapsOnlyTheReservedDocsFallbacks()
    {
        // Guards the DocsRoutes filter: in Production the only docs-prefixed endpoints are the two reservations.
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseEnvironment(Environments.Production));

        var reserved = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.Metadata.GetMetadata<ReservedPathMetadata>() is not null)
            .Select(endpoint => endpoint.RoutePattern.RawText)
            .Order(StringComparer.Ordinal)
            .ToList();

        reserved.ShouldBe(["/openapi/{**path}", "/scalar/{**path}"]);
    }

    [Theory]
    [InlineData("/health")]
    [InlineData("/api/v1/nope")]
    [InlineData("/scalar")]
    [InlineData("/openapi/v1.json")]
    public async Task NoUnsafeInlineOutsideDevScalar(string path)
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseEnvironment(Environments.Production));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        var csp = SecurityHeadersTests.Single(response, SecurityHeadersTests.CspHeader);
        csp.ShouldBe(SecurityHeadersTests.StrictCsp);
        csp.ShouldNotContain("unsafe-inline", Case.Sensitive);
        csp.ShouldNotContain("unsafe-eval", Case.Sensitive);
    }

    // Real docs routes only: the reserved-prefix 404 fallbacks (ReservedPathMetadata, D-29) are not API docs.
    private static List<string> DocsRoutes(IServiceProvider services) =>
        [.. services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.Metadata.GetMetadata<ReservedPathMetadata>() is null)
            .Select(endpoint => endpoint.RoutePattern.RawText?.TrimStart('/') ?? string.Empty)
            .Where(route => DocsPrefixes.Any(prefix => route.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)))];

    [GeneratedRegex("nonce=\"(?<nonce>[^\"]*)\"", RegexOptions.CultureInvariant)]
    private static partial Regex NonceAttribute();

    // Inline scripts: <script> tags without a src attribute.
    [GeneratedRegex("<script(?![^>]*\\bsrc=)[^>]*>", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex InlineScriptTag();
}
