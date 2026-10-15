using System.Net;
using System.Text;
using Csps.Server.Security;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.RateLimiting;

/// <summary>
/// SEC-03: who shares a bucket. IPv4 clients are limited per address, IPv6 clients per /48, and a request with no address
/// shares one bucket. Over-limit requests are rejected at once, never queued.
/// </summary>
public sealed class RateLimitPartitionTests
{
    // The sign-in limit is 10 a minute; an empty body is a cheap 400 that proves the request was handled.
    private const int SignInLimit = 10;

    [Fact]
    public async Task TwoIPv4AddressesHaveSeparateBuckets()
    {
        await using var factory = new RealLimitsFactory { RemoteIpFromHeader = true };
        using var client = factory.CreateClient();

        await FillAsync(client, "203.0.113.1");

        (await SendAsync(client, "203.0.113.1")).ShouldBe(HttpStatusCode.TooManyRequests);
        (await SendAsync(client, "203.0.113.2")).ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task IPv6AddressesInOneSlash48ShareABucketAndOtherSlash48sDoNot()
    {
        await using var factory = new RealLimitsFactory { RemoteIpFromHeader = true };
        using var client = factory.CreateClient();

        await FillAsync(client, "2001:db8:1:2::10");

        (await SendAsync(client, "2001:db8:1:2::20")).ShouldBe(HttpStatusCode.TooManyRequests);
        (await SendAsync(client, "2001:db8:1:3::10")).ShouldBe(HttpStatusCode.TooManyRequests);
        (await SendAsync(client, "2001:db8:2:2::10")).ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AnIPv4AddressSentAsIPv4MappedIPv6SharesTheIPv4Bucket()
    {
        await using var factory = new RealLimitsFactory { RemoteIpFromHeader = true };
        using var client = factory.CreateClient();

        await FillAsync(client, "203.0.113.7");

        (await SendAsync(client, "::ffff:203.0.113.7")).ShouldBe(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task RequestsWithNoAddressShareOneBucketAndAreStillLimited()
    {
        await using var factory = new RealLimitsFactory { RemoteIpFromHeader = true };
        using var client = factory.CreateClient();

        await FillAsync(client, null);

        (await SendAsync(client, null)).ShouldBe(HttpStatusCode.TooManyRequests);
        (await SendAsync(client, "203.0.113.9")).ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ParallelRequestsOverTheLimitAreRejectedAtOnceNeverQueued()
    {
        await using var factory = new RealLimitsFactory { RemoteIpFromHeader = true };
        using var client = factory.CreateClient();

        var statuses = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => Task.Run(() => SendAsync(client, "203.0.113.50"))));

        statuses.Count(status => status == HttpStatusCode.BadRequest).ShouldBe(SignInLimit);
        statuses.Count(status => status == HttpStatusCode.TooManyRequests).ShouldBe(SignInLimit);
    }

    [Theory]
    [InlineData(null, "unknown")]
    [InlineData("203.0.113.1", "203.0.113.1")]
    [InlineData("::ffff:203.0.113.1", "203.0.113.1")]
    [InlineData("2001:db8:1:2:aaaa:bbbb:cccc:dddd", "2001:db8:1::/48")]
    [InlineData("2001:db8:1:2::1", "2001:db8:1::/48")]
    [InlineData("2001:db8:1:ffff::1", "2001:db8:1::/48")]
    [InlineData("2001:db8:2:2::1", "2001:db8:2::/48")]
    public void PartitionKeysAreBounded(string? address, string expected)
    {
        var parsed = address is null ? null : IPAddress.Parse(address);

        RateLimitingRegistration.PartitionKey(parsed).ShouldBe(expected);
    }

    [Fact]
    public void TheDefaultLimitsAreTheOwnerNumbers()
    {
        var settings = new RateLimitSettings();

        (settings.SignIn.PermitLimit, settings.SignIn.Window).ShouldBe((10, TimeSpan.FromMinutes(1)));
        (settings.Verify.PermitLimit, settings.Verify.Window).ShouldBe((10, TimeSpan.FromMinutes(1)));
        (settings.Resend.PermitLimit, settings.Resend.Window).ShouldBe((5, TimeSpan.FromMinutes(1)));
        (settings.Forgot.PermitLimit, settings.Forgot.Window).ShouldBe((5, TimeSpan.FromMinutes(15)));
        (settings.Reset.PermitLimit, settings.Reset.Window).ShouldBe((10, TimeSpan.FromMinutes(15)));
        (settings.Refresh.PermitLimit, settings.Refresh.Window).ShouldBe((60, TimeSpan.FromMinutes(1)));
        settings.Validate().ShouldBeEmpty();
    }

    [Fact]
    public void AnUnusableLimitIsNamedAndNeverEchoed()
    {
        var settings = new RateLimitSettings();
        settings.Forgot.PermitLimit = 0;
        settings.Reset.Window = TimeSpan.FromSeconds(1);

        var problems = settings.Validate();

        problems.Count.ShouldBe(2);
        problems.ShouldContain("RateLimits:Auth:Forgot:PermitLimit must be at least 1.");
        problems.ShouldContain("RateLimits:Auth:Reset:Window must be at least 6 seconds.");
    }

    private static async Task FillAsync(HttpClient client, string? address)
    {
        for (var attempt = 1; attempt <= SignInLimit; attempt++)
        {
            (await SendAsync(client, address)).ShouldBe(HttpStatusCode.BadRequest, $"request {attempt} is inside the limit");
        }
    }

    private static async Task<HttpStatusCode> SendAsync(HttpClient client, string? address)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri("/api/v1/auth/sign-in", UriKind.Relative))
        {
            Content = new StringContent(string.Empty, Encoding.UTF8, "application/json"),
        };
        if (address is not null)
        {
            request.Headers.Add(RemoteIpStartupFilter.HeaderName, address);
        }

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        return response.StatusCode;
    }
}
