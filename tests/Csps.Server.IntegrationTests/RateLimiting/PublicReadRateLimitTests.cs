using System.Net;
using Csps.Application.Ports;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.RateLimiting;

/// <summary>
/// SEC-03, RESEARCH P-10: <c>/api/v1/public/*</c> allows one address 600 reads a minute. The shell, robots.txt and sitemap.xml are never
/// limited, so a crawler or a widely shared link is never refused.
/// </summary>
public sealed class PublicReadRateLimitTests
{
    private const int PerMinute = 600;
    private const string Route = "/api/v1/public/site";

    [Fact]
    public async Task TheSixHundredAndFirstReadInAMinuteFromOneAddressGets429AndAnotherAddressIsUnaffected()
    {
        await using var baseFactory = Factory();
        await using var factory = WithStubbedContent(baseFactory);
        using var client = factory.CreateClient();

        for (var attempt = 1; attempt <= PerMinute; attempt++)
        {
            using var inside = await GetAsync(client, Route, "203.0.113.40");
            inside.StatusCode.ShouldBe(HttpStatusCode.OK, $"read {attempt} is inside the limit");
        }

        using var rejected = await GetAsync(client, Route, "203.0.113.40");
        using var other = await GetAsync(client, Route, "203.0.113.41");

        rejected.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        var problem = await ProblemJson.ReadAsync(rejected, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("rate-limited");
        rejected.Headers.RetryAfter.ShouldNotBeNull().Delta.ShouldNotBeNull().TotalSeconds.ShouldBeInRange(1, 60);
        other.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/products")]
    [InlineData("/robots.txt")]
    [InlineData("/sitemap.xml")]
    public async Task TheShellRobotsAndSitemapAreNeverLimited(string path)
    {
        await using var baseFactory = Factory();
        await using var factory = WithStubbedContent(baseFactory);
        using var client = factory.CreateClient();

        for (var attempt = 1; attempt <= PerMinute + 20; attempt++)
        {
            using var response = await GetAsync(client, path, "203.0.113.50");
            response.StatusCode.ShouldBe(HttpStatusCode.OK, $"{path} read {attempt}");
        }
    }

    private static RealLimitsFactory Factory() => new() { RemoteIpFromHeader = true };

    // The host has no database, so the public reads come from a stub.
    private static WebApplicationFactory<Program> WithStubbedContent(RealLimitsFactory factory) =>
        factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(
            services => services.AddSingleton<IPublicContentReader>(new StubPublicContentReader(ShellTestFactory.DefaultBusinessName))));

    private static async Task<HttpResponseMessage> GetAsync(HttpClient client, string path, string address)
    {
        using var request = ApiRequests.Get(path);
        request.Headers.Add(RemoteIpStartupFilter.HeaderName, address);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
