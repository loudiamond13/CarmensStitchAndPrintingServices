using System.Net;
using System.Reflection;
using Csps.Application.Analytics;
using Csps.Server.IntegrationTests.Analytics;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.Security;
using Csps.Testing;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.RateLimiting;

/// <summary>
/// ANL-06, D-51, D-74: the analytics rate limits (the page view limit and the site-wide ceiling). The numbers can be changed in configuration, and an unusable setting stops the host at
/// start-up naming the setting and never the value.
/// </summary>
public sealed class AnalyticsRateLimitTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int CollectPerMinute = 120;

    [Fact]
    public async Task OnlyThePageViewAndCeilingRulesRemainForAnalytics()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var analytics = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.RoutePattern.RawText!.StartsWith("api/v1/analytics", StringComparison.Ordinal))
            .ToList();
        var analyticsPolicyNames = typeof(RateLimitPolicies)
            .GetFields(BindingFlags.Public | BindingFlags.Static | BindingFlags.FlattenHierarchy)
            .Where(field => field.IsLiteral && field.FieldType == typeof(string))
            .Select(field => (string)field.GetRawConstantValue()!)
            .Where(name => name.Contains("analytics", StringComparison.Ordinal))
            .ToList();

        analytics.ShouldNotBeEmpty();
        analytics.SelectMany(endpoint => endpoint.Metadata.GetOrderedMetadata<EnableRateLimitingAttribute>())
            .Select(attribute => attribute.PolicyName)
            .Distinct()
            .ShouldBe([RateLimitPolicies.AnalyticsCollect]);
        analyticsPolicyNames.ShouldBe([RateLimitPolicies.AnalyticsCollect]);
        AnalyticsCollectRateLimit.Default().PermitLimit.ShouldBe(CollectPerMinute);
    }

    [Fact]
    public async Task The121stPageViewInAMinuteFromOneAddressGets429AndAnotherAddressIsUnaffected()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(database.ConnectionString) { RemoteIpFromHeader = true };
        using var client = AnalyticsHttp.NewClient(factory);

        for (var attempt = 1; attempt <= CollectPerMinute; attempt++)
        {
            using var inside = await PostPageViewAsync(client, "203.0.113.70");
            inside.StatusCode.ShouldBe(HttpStatusCode.NoContent, $"page view {attempt} is inside the limit");
        }

        using var rejected = await PostPageViewAsync(client, "203.0.113.70");
        using var other = await PostPageViewAsync(client, "203.0.113.71");

        rejected.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        var problem = await ProblemJson.ReadAsync(rejected, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("rate-limited");
        rejected.Headers.RetryAfter.ShouldNotBeNull().Delta.ShouldNotBeNull().TotalSeconds.ShouldBeInRange(1, 60);
        other.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        context.DailyPageCounts.Sum(row => row.Views).ShouldBe(CollectPerMinute + 1);
    }

    [Fact]
    public async Task ThePageViewLimitCanBeChangedInConfiguration()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(database.ConnectionString, new Dictionary<string, string> { ["RateLimits:AnalyticsCollect:PermitLimit"] = "2" })
        {
            RemoteIpFromHeader = true,
        };
        using var client = AnalyticsHttp.NewClient(factory);

        using var first = await PostPageViewAsync(client, "203.0.113.72");
        using var second = await PostPageViewAsync(client, "203.0.113.72");
        using var third = await PostPageViewAsync(client, "203.0.113.72");

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        third.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public void ThePageViewDefaultIs120AMinuteInTheAnalyticsCollectSection()
    {
        var rule = AnalyticsCollectRateLimit.Default();

        (rule.PermitLimit, rule.Window).ShouldBe((120, TimeSpan.FromMinutes(1)));
        AnalyticsCollectRateLimit.Validate(rule).ShouldBeEmpty();
        AnalyticsCollectRateLimit.SectionName.ShouldBe("RateLimits:AnalyticsCollect");
        RateLimitPolicies.AnalyticsCollect.ShouldBe("analytics-collect");
    }

    [Fact]
    public void AnUnusablePageViewLimitIsNamedAndNeverEchoed()
    {
        var problems = AnalyticsCollectRateLimit.Validate(new RateLimitRule { PermitLimit = 0, Window = TimeSpan.FromSeconds(1) });

        problems.ShouldBe(["RateLimits:AnalyticsCollect:PermitLimit must be at least 1.", "RateLimits:AnalyticsCollect:Window must be at least 6 seconds."]);
    }

    [Fact]
    public async Task AHostWithAnUnusablePageViewLimitDoesNotStartAndNamesTheSetting()
    {
        await using var factory = new RealLimitsFactory(new Dictionary<string, string> { ["RateLimits:AnalyticsCollect:PermitLimit"] = "0" });

        var failure = Should.Throw<InvalidOperationException>(() => factory.CreateClient());

        failure.Message.ShouldContain("RateLimits:AnalyticsCollect:PermitLimit must be at least 1.");
    }

    [Fact]
    public async Task TheSiteWideCeilingStopsThePageViewRouteAcrossAddresses()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(database.ConnectionString, new Dictionary<string, string> { ["RateLimits:AnalyticsCeiling:PermitLimit"] = "3" })
        {
            RemoteIpFromHeader = true,
        };
        using var client = AnalyticsHttp.NewClient(factory);

        foreach (var address in new[] { "203.0.113.81", "203.0.113.82", "203.0.113.83" })
        {
            using var inside = await PostPageViewAsync(client, address);
            inside.StatusCode.ShouldBe(HttpStatusCode.NoContent, $"a page view from {address} is inside the ceiling");
        }

        using var rejected = await PostPageViewAsync(client, "203.0.113.84");

        rejected.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        var problem = await ProblemJson.ReadAsync(rejected, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("rate-limited");
        rejected.Headers.RetryAfter.ShouldNotBeNull().Delta.ShouldNotBeNull().TotalSeconds.ShouldBeInRange(1, 60);
    }

    [Fact]
    public async Task APageViewRefusedPerAddressDoesNotUseUpTheSiteWideCeiling()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(
            database.ConnectionString,
            new Dictionary<string, string>
            {
                ["RateLimits:AnalyticsCollect:PermitLimit"] = "2",
                ["RateLimits:AnalyticsCeiling:PermitLimit"] = "5",
            })
        {
            RemoteIpFromHeader = true,
        };
        using var client = AnalyticsHttp.NewClient(factory);

        for (var attempt = 1; attempt <= 6; attempt++)
        {
            using var noisy = await PostPageViewAsync(client, "203.0.113.90");
            noisy.StatusCode.ShouldBe(attempt <= 2 ? HttpStatusCode.NoContent : HttpStatusCode.TooManyRequests);
        }

        using var other = await PostPageViewAsync(client, "203.0.113.91");

        other.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task TheCeilingLeavesOtherRoutesAlone()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(database.ConnectionString, new Dictionary<string, string> { ["RateLimits:AnalyticsCeiling:PermitLimit"] = "3" })
        {
            RemoteIpFromHeader = true,
        };
        using var client = AnalyticsHttp.NewClient(factory);

        foreach (var address in new[] { "203.0.113.81", "203.0.113.82", "203.0.113.83", "203.0.113.84" })
        {
            using var page = await PostPageViewAsync(client, address);
        }

        using var read = new HttpRequestMessage(HttpMethod.Get, new Uri("/api/v1/public/site", UriKind.Relative));
        read.Headers.Add(RemoteIpStartupFilter.HeaderName, "203.0.113.85");
        using var response = await client.SendAsync(read, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public void TheCeilingDefaultIs600AMinuteInTheAnalyticsCeilingSection()
    {
        var rule = AnalyticsCeilingRateLimit.Default();

        (rule.PermitLimit, rule.Window).ShouldBe((600, TimeSpan.FromMinutes(1)));
        AnalyticsCeilingRateLimit.Validate(rule).ShouldBeEmpty();
        AnalyticsCeilingRateLimit.SectionName.ShouldBe("RateLimits:AnalyticsCeiling");
    }

    [Fact]
    public void TheCeilingRuleNamesTheSettingForABadLimitOrWindow()
    {
        var problems = AnalyticsCeilingRateLimit.Validate(new RateLimitRule { PermitLimit = 0, Window = TimeSpan.FromSeconds(1) });

        problems.ShouldBe(["RateLimits:AnalyticsCeiling:PermitLimit must be at least 1.", "RateLimits:AnalyticsCeiling:Window must be at least 6 seconds."]);
    }

    [Fact]
    public async Task ABadCeilingStopsStartUpAndNamesTheSettingNotTheValue()
    {
        await using var factory = new RealLimitsFactory(new Dictionary<string, string> { ["RateLimits:AnalyticsCeiling:PermitLimit"] = "0" });

        var failure = Should.Throw<InvalidOperationException>(() => factory.CreateClient());

        failure.Message.ShouldContain("RateLimits:AnalyticsCeiling:PermitLimit must be at least 1.");
        failure.Message.ShouldNotContain("=0");
    }

    private static async Task<HttpResponseMessage> PostPageViewAsync(HttpClient client, string address)
    {
        using var request = PageViewCollectTests.NewPost(PageViewCollectTests.PathBody("/gallery"));
        request.Headers.Add(RemoteIpStartupFilter.HeaderName, address);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
