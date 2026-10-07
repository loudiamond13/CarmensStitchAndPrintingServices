using System.Net;
using System.Net.Http.Headers;
using Csps.Testing;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// FND-05, D-26, D-27: every API error is an RFC 9457 ProblemDetails with a plain-English title and a 32-hex
/// <c>traceId</c>, and an unknown <c>/api</c> route never falls through to a page.
/// </summary>
public sealed class ProblemDetailsTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string NotFoundTitle = "We couldn't find that.";

    [Theory]
    [InlineData("GET", "/api")]
    [InlineData("GET", "/api/")]
    [InlineData("GET", "/api/v1/nope")]
    [InlineData("GET", "/api/v1/nope.json")]
    [InlineData("POST", "/api")]
    [InlineData("POST", "/api/")]
    [InlineData("POST", "/api/v1/nope")]
    [InlineData("POST", "/api/v1/nope.json")]
    [InlineData("PUT", "/api")]
    [InlineData("PUT", "/api/")]
    [InlineData("PUT", "/api/v1/nope")]
    [InlineData("PUT", "/api/v1/nope.json")]
    [InlineData("DELETE", "/api")]
    [InlineData("DELETE", "/api/")]
    [InlineData("DELETE", "/api/v1/nope")]
    [InlineData("DELETE", "/api/v1/nope.json")]
    public async Task UnknownApiRouteIsProblem404(string method, string path)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(new HttpMethod(method), new Uri(path, UriKind.Relative));

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("title").GetString().ShouldBe(NotFoundTitle);
        problem.GetProperty("status").GetInt32().ShouldBe(404);
        ProblemJson.TraceId(problem);
    }

    [Fact]
    public async Task HtmlAcceptStillGetsProblemJson()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri("/api/v1/nope", UriKind.Relative));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/html"));

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("title").GetString().ShouldBe(NotFoundTitle);
        ProblemJson.TraceId(problem);
    }

    [Fact]
    public async Task ParallelRequestsGetDistinctTraceIds()
    {
        const int RequestCount = 10;
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        var traceIds = await Task.WhenAll(Enumerable.Range(0, RequestCount).Select(async _ =>
        {
            using var response = await client.GetAsync(new Uri("/api/v1/nope", UriKind.Relative), TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
            var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
            return ProblemJson.TraceId(problem);
        }));

        traceIds.Distinct(StringComparer.Ordinal).Count().ShouldBe(RequestCount);
    }

    [Fact]
    public async Task UnhandledExceptionIsGeneric500WithReference()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services => services.AddTransient<IStartupFilter, ThrowingEndpointFilter>()));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(ThrowingEndpointFilter.Path, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.InternalServerError);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldNotContain("Exception", Case.Insensitive);
        body.ShouldNotContain(ThrowingEndpointFilter.SecretText);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        var traceId = ProblemJson.TraceId(problem);
        problem.GetProperty("title").GetString().ShouldBe("Something went wrong.");
        problem.GetProperty("status").GetInt32().ShouldBe(500);
        problem.GetProperty("detail").GetString().ShouldBe($"Something went wrong. Reference: {traceId}");
        response.Headers.GetValues(SecurityHeadersTests.CspHeader).ShouldHaveSingleItem().ShouldBe(SecurityHeadersTests.StrictCsp);
    }

    /// <summary>Appends a terminal middleware that throws on one test-only path, after the real pipeline.</summary>
    private sealed class ThrowingEndpointFilter : IStartupFilter
    {
        public const string Path = "/test-only/throws";
        public const string SecretText = "SELECT secret FROM Users";

        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            next(app);
            app.Run(context => context.Request.Path.StartsWithSegments(Path, StringComparison.Ordinal)
                ? throw new InvalidOperationException(SecretText)
                : Task.CompletedTask);
        };
    }
}
