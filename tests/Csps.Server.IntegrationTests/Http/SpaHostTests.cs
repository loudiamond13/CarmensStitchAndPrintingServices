using System.Net;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// WEB-01, FND-05: the API host serves the built React shell anonymously from its web root at any non-file path,
/// under the strict CSP, while unknown <c>/api</c> paths keep answering a ProblemDetails 404. The suite runs against
/// the committed fixture web root (<see cref="CspsApiFactory.FixtureWebRoot"/>), never a local <c>npm run build</c>.
/// </summary>
public sealed class SpaHostTests
{
    private const string FixtureShellMarker = "CSPS fixture shell";

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
}
