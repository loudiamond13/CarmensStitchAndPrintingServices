using System.Net;
using Csps.Server.IntegrationTests.Analytics;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.Security;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.RateLimiting;

/// <summary>
/// ANL-07, T-12-20: one address may send 30 consent decisions a minute. The numbers can be changed in configuration, and an unusable
/// setting stops the host at start-up naming the setting and never the value.
/// </summary>
public sealed class AnalyticsRateLimitTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int PerMinute = 30;
    private const string Route = "/api/v1/analytics/consent";

    [Fact]
    public async Task TheThirtyFirstDecisionInAMinuteFromOneAddressGets429AndAnotherAddressIsUnaffected()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(database.ConnectionString) { RemoteIpFromHeader = true };
        using var client = ConsentEndpointTests.NewClient(factory);

        for (var attempt = 1; attempt <= PerMinute; attempt++)
        {
            using var inside = await PostAsync(client, "203.0.113.60");
            inside.StatusCode.ShouldBe(HttpStatusCode.OK, $"decision {attempt} is inside the limit");
        }

        using var rejected = await PostAsync(client, "203.0.113.60");
        using var other = await PostAsync(client, "203.0.113.61");

        rejected.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        var problem = await ProblemJson.ReadAsync(rejected, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("rate-limited");
        rejected.Headers.RetryAfter.ShouldNotBeNull().Delta.ShouldNotBeNull().TotalSeconds.ShouldBeInRange(1, 60);
        other.StatusCode.ShouldBe(HttpStatusCode.OK);
        ConsentEndpointTests.SetCookieOf(rejected, AnalyticsCookies.ConsentCookieName).ShouldBeNull();
    }

    [Fact]
    public async Task TheLimitCanBeChangedInConfiguration()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(database.ConnectionString, new Dictionary<string, string> { ["RateLimits:Consent:PermitLimit"] = "2" })
        {
            RemoteIpFromHeader = true,
        };
        using var client = ConsentEndpointTests.NewClient(factory);

        using var first = await PostAsync(client, "203.0.113.62");
        using var second = await PostAsync(client, "203.0.113.62");
        using var third = await PostAsync(client, "203.0.113.62");

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        third.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task ARejectedDecisionIsNotRecorded()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(database.ConnectionString, new Dictionary<string, string> { ["RateLimits:Consent:PermitLimit"] = "1" })
        {
            RemoteIpFromHeader = true,
        };
        using var client = ConsentEndpointTests.NewClient(factory);

        using var accepted = await PostAsync(client, "203.0.113.63");
        using var rejected = await PostAsync(client, "203.0.113.63");

        accepted.StatusCode.ShouldBe(HttpStatusCode.OK);
        rejected.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        await using var context = database.CreateContext();
        context.ConsentRecords.Count().ShouldBe(1);
    }

    [Fact]
    public void TheDefaultIsThirtyAMinuteInTheConsentSection()
    {
        var rule = ConsentRateLimit.Default();

        (rule.PermitLimit, rule.Window).ShouldBe((30, TimeSpan.FromMinutes(1)));
        ConsentRateLimit.Validate(rule).ShouldBeEmpty();
        ConsentRateLimit.SectionName.ShouldBe("RateLimits:Consent");
        RateLimitPolicies.Consent.ShouldBe("analytics-consent");
    }

    [Fact]
    public void AnUnusableConsentLimitIsNamedAndNeverEchoed()
    {
        var problems = ConsentRateLimit.Validate(new RateLimitRule { PermitLimit = 0, Window = TimeSpan.FromSeconds(1) });

        problems.ShouldBe(["RateLimits:Consent:PermitLimit must be at least 1.", "RateLimits:Consent:Window must be at least 6 seconds."]);
    }

    [Fact]
    public async Task AHostWithAnUnusableConsentLimitDoesNotStartAndNamesTheSetting()
    {
        await using var factory = new RealLimitsFactory(new Dictionary<string, string> { ["RateLimits:Consent:PermitLimit"] = "0" });

        var failure = Should.Throw<InvalidOperationException>(() => factory.CreateClient());

        failure.Message.ShouldContain("RateLimits:Consent:PermitLimit must be at least 1.");
    }

    private static async Task<HttpResponseMessage> PostAsync(HttpClient client, string address)
    {
        using var request = ConsentEndpointTests.NewPost(ConsentEndpointTests.AcceptAll());
        request.Headers.Add(RemoteIpStartupFilter.HeaderName, address);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
