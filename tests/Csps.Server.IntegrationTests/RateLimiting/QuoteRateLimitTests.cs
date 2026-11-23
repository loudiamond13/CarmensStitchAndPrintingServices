using System.Net;
using System.Net.Http.Json;
using Csps.Domain.QuoteRequests;
using Csps.Server.IntegrationTests.Analytics;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.QuoteRequests;
using Csps.Testing;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.RateLimiting;

/// <summary>
/// INQ-03, D-26: one address may send 5 quote requests an hour and the whole site 60 an hour. The numbers are settings, an unusable
/// setting stops start-up naming the setting and never the value, and the other public routes keep their own limits.
/// </summary>
public sealed class QuoteRateLimitTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string PerAddressDetail = "Too many attempts from this address. Please wait and try again.";
    private const string SiteBusyDetail = "The site is busy. Please try again in a minute.";
    private const string HighLimit = "100000";

    [Fact]
    public async Task TheCreateActionCarriesTheQuoteCreatePolicy()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var create = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Single(endpoint => endpoint.Metadata.GetMetadata<IEndpointNameMetadata>()?.EndpointName == "CreateQuoteRequest");

        create.Metadata.GetMetadata<EnableRateLimitingAttribute>().ShouldNotBeNull().PolicyName.ShouldBe("quote-create");
    }

    [Fact]
    public async Task TheSixthCreateFromOneAddressIs429WithAWholeSecondRetryAfter()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(database.ConnectionString) { RemoteIpFromHeader = true };
        using var client = AnalyticsHttp.NewClient(factory);
        var ticket = await QuoteRequestFixtures.GetTicketAsync(client);

        for (var attempt = 1; attempt <= 5; attempt++)
        {
            using var inside = await PostCreateAsync(client, "203.0.113.110", ticket, attempt);
            inside.StatusCode.ShouldBe(HttpStatusCode.OK, $"create {attempt} is inside the limit");
        }

        using var rejected = await PostCreateAsync(client, "203.0.113.110", ticket, 6);
        using var other = await PostCreateAsync(client, "203.0.113.111", ticket, 7);

        rejected.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        var problem = await ProblemJson.ReadAsync(rejected, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("rate-limited");
        problem.GetProperty("detail").GetString().ShouldBe(PerAddressDetail);
        var wait = rejected.Headers.RetryAfter.ShouldNotBeNull().Delta.ShouldNotBeNull().TotalSeconds;
        wait.ShouldBeInRange(1, 3600);
        (wait % 1).ShouldBe(0, "Retry-After is whole seconds");
        other.StatusCode.ShouldBe(HttpStatusCode.OK, "another address is not affected");
        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(6, "the refused create saved nothing");
    }

    [Fact]
    public async Task ThePerAddressLimitCanBeChangedInConfiguration()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(database.ConnectionString, new Dictionary<string, string> { ["RateLimits:QuoteCreate:PermitLimit"] = "2" })
        {
            RemoteIpFromHeader = true,
        };
        using var client = AnalyticsHttp.NewClient(factory);
        var ticket = await QuoteRequestFixtures.GetTicketAsync(client);

        using var first = await PostCreateAsync(client, "203.0.113.112", ticket, 1);
        using var second = await PostCreateAsync(client, "203.0.113.112", ticket, 2);
        using var third = await PostCreateAsync(client, "203.0.113.112", ticket, 3);

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        third.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task TheSiteWideCeilingStopsManyAddressesAndSaysTheSiteIsBusy()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(
            database.ConnectionString,
            new Dictionary<string, string> { ["RateLimits:QuoteCreate:PermitLimit"] = HighLimit, ["RateLimits:QuoteCeiling:PermitLimit"] = "3" })
        {
            RemoteIpFromHeader = true,
        };
        using var client = AnalyticsHttp.NewClient(factory);
        var ticket = await QuoteRequestFixtures.GetTicketAsync(client);

        var number = 0;
        foreach (var address in new[] { "203.0.113.121", "203.0.113.122", "203.0.113.123" })
        {
            using var inside = await PostCreateAsync(client, address, ticket, ++number);
            inside.StatusCode.ShouldBe(HttpStatusCode.OK, $"a create from {address} is inside the ceiling");
        }

        using var rejected = await PostCreateAsync(client, "203.0.113.124", ticket, ++number);

        rejected.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        var problem = await ProblemJson.ReadAsync(rejected, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("rate-limited");
        problem.GetProperty("detail").GetString().ShouldBe(SiteBusyDetail);
        var wait = rejected.Headers.RetryAfter.ShouldNotBeNull().Delta.ShouldNotBeNull().TotalSeconds;
        wait.ShouldBeInRange(1, 3600);
        (wait % 1).ShouldBe(0);
    }

    [Fact]
    public async Task ACreateRefusedPerAddressDoesNotUseUpTheSiteWideCeiling()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(
            database.ConnectionString,
            new Dictionary<string, string> { ["RateLimits:QuoteCreate:PermitLimit"] = "2", ["RateLimits:QuoteCeiling:PermitLimit"] = "5" })
        {
            RemoteIpFromHeader = true,
        };
        using var client = AnalyticsHttp.NewClient(factory);
        var ticket = await QuoteRequestFixtures.GetTicketAsync(client);

        for (var attempt = 1; attempt <= 6; attempt++)
        {
            using var noisy = await PostCreateAsync(client, "203.0.113.130", ticket, attempt);
            noisy.StatusCode.ShouldBe(attempt <= 2 ? HttpStatusCode.OK : HttpStatusCode.TooManyRequests);
            if (attempt > 2)
            {
                var problem = await ProblemJson.ReadAsync(noisy, TestContext.Current.CancellationToken);
                problem.GetProperty("detail").GetString().ShouldBe(PerAddressDetail);
            }
        }

        var number = 6;
        foreach (var address in new[] { "203.0.113.131", "203.0.113.132", "203.0.113.133" })
        {
            using var other = await PostCreateAsync(client, address, ticket, ++number);
            other.StatusCode.ShouldBe(HttpStatusCode.OK, "the four refused creates did not use the ceiling");
        }
    }

    [Fact]
    public async Task TheQuoteCeilingLeavesTheTicketThePhotoAndThePageViewRoutesAlone()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(
            database.ConnectionString,
            new Dictionary<string, string> { ["RateLimits:QuoteCreate:PermitLimit"] = HighLimit, ["RateLimits:QuoteCeiling:PermitLimit"] = "1" })
        {
            RemoteIpFromHeader = true,
        };
        using var client = AnalyticsHttp.NewClient(factory);
        var ticket = await QuoteRequestFixtures.GetTicketAsync(client);
        using var used = await PostCreateAsync(client, "203.0.113.140", ticket, 1);
        used.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var refused = await PostCreateAsync(client, "203.0.113.141", ticket, 2);
        refused.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);

        using var ticketRead = new HttpRequestMessage(HttpMethod.Get, new Uri($"{QuoteRequestFixtures.Route}/ticket", UriKind.Relative));
        ticketRead.Headers.Add(RemoteIpStartupFilter.HeaderName, "203.0.113.142");
        using var ticketAnswer = await client.SendAsync(ticketRead, TestContext.Current.CancellationToken);
        using var photo = new HttpRequestMessage(HttpMethod.Post, new Uri($"{QuoteRequestFixtures.Route}/{Guid.NewGuid():D}/photos/0", UriKind.Relative));
        photo.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        photo.Headers.Add(RemoteIpStartupFilter.HeaderName, "203.0.113.143");
        using var photoAnswer = await client.SendAsync(photo, TestContext.Current.CancellationToken);

        ticketAnswer.StatusCode.ShouldBe(HttpStatusCode.OK);
        photoAnswer.StatusCode.ShouldNotBe(HttpStatusCode.TooManyRequests);
    }

    [Theory]
    [InlineData("RateLimits:QuoteCreate:PermitLimit", "0", "RateLimits:QuoteCreate:PermitLimit must be at least 1.")]
    [InlineData("RateLimits:QuoteCreate:Window", "00:00:01", "RateLimits:QuoteCreate:Window must be at least 6 seconds.")]
    [InlineData("RateLimits:QuoteCeiling:PermitLimit", "0", "RateLimits:QuoteCeiling:PermitLimit must be at least 1.")]
    [InlineData("RateLimits:QuoteCeiling:Window", "00:00:01", "RateLimits:QuoteCeiling:Window must be at least 6 seconds.")]
    public async Task AnUnusableQuoteLimitStopsStartUpAndNamesTheSettingNotTheValue(string key, string value, string message)
    {
        await using var factory = new RealLimitsFactory(new Dictionary<string, string> { [key] = value });

        var failure = Should.Throw<InvalidOperationException>(() => factory.CreateClient());

        failure.Message.ShouldContain(message);
        failure.Message.ShouldNotContain($"={value}");
    }

    private static async Task<HttpResponseMessage> PostCreateAsync(HttpClient client, string address, string ticket, int number)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, QuoteRequestFixtures.Route);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        request.Headers.Add(RemoteIpStartupFilter.HeaderName, address);
        request.Content = JsonContent.Create(new Dictionary<string, object?>
        {
            ["customerName"] = $"Juan Dela Cruz {number}",
            ["contactNumber"] = $"09171{number:D6}",
            ["ticket"] = ticket,
        });
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
