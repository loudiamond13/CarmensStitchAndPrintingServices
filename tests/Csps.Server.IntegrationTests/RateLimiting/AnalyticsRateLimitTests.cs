using System.Net;
using Csps.Application.Analytics;
using Csps.Domain.Analytics;
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
    private const int CollectPerMinute = 120;
    private const int ClearPerMinute = 5;
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

    [Fact]
    public async Task The121stPageViewInAMinuteFromOneAddressGets429AndAnotherAddressIsUnaffected()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(database.ConnectionString) { RemoteIpFromHeader = true };
        using var client = ConsentEndpointTests.NewClient(factory);

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
        using var client = ConsentEndpointTests.NewClient(factory);

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
        using var client = ConsentEndpointTests.NewClient(factory);

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
    public async Task TheCeilingLeavesOtherRoutesAlone()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(database.ConnectionString, new Dictionary<string, string> { ["RateLimits:AnalyticsCeiling:PermitLimit"] = "3" })
        {
            RemoteIpFromHeader = true,
        };
        using var client = ConsentEndpointTests.NewClient(factory);

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
    public async Task TheSixthClearInAMinuteFromOneAddressGets429WithItsOwnMessageAndAnotherAddressIsUnaffected()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(database.ConnectionString) { RemoteIpFromHeader = true };
        using var client = ConsentEndpointTests.NewClient(factory);

        for (var attempt = 1; attempt <= ClearPerMinute; attempt++)
        {
            using var inside = await PostClearAsync(client, "203.0.113.80");
            inside.StatusCode.ShouldBe(HttpStatusCode.OK, $"clear {attempt} is inside the limit");
        }

        using var rejected = await PostClearAsync(client, "203.0.113.80");
        using var other = await PostClearAsync(client, "203.0.113.81");

        rejected.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        var problem = await ProblemJson.ReadAsync(rejected, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("rate-limited");
        problem.GetProperty("detail").GetString().ShouldBe("Too many tries. Wait a minute and try again.");
        rejected.Headers.RetryAfter.ShouldNotBeNull().Delta.ShouldNotBeNull().TotalSeconds.ShouldBeInRange(1, 60);
        other.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task TheOtherAnalyticsPoliciesKeepTheGeneralMessage()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(database.ConnectionString, new Dictionary<string, string> { ["RateLimits:Consent:PermitLimit"] = "1" })
        {
            RemoteIpFromHeader = true,
        };
        using var client = ConsentEndpointTests.NewClient(factory);

        using var accepted = await PostAsync(client, "203.0.113.82");
        using var rejected = await PostAsync(client, "203.0.113.82");

        rejected.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        var problem = await ProblemJson.ReadAsync(rejected, TestContext.Current.CancellationToken);
        problem.GetProperty("detail").GetString().ShouldBe("Too many attempts from this address. Please wait and try again.");
    }

    [Fact]
    public async Task TheClearLimitCanBeChangedInConfiguration()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(database.ConnectionString, new Dictionary<string, string> { ["RateLimits:AnalyticsClear:PermitLimit"] = "2" })
        {
            RemoteIpFromHeader = true,
        };
        using var client = ConsentEndpointTests.NewClient(factory);

        using var first = await PostClearAsync(client, "203.0.113.83");
        using var second = await PostClearAsync(client, "203.0.113.83");
        using var third = await PostClearAsync(client, "203.0.113.83");

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        third.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task ARejectedClearDeletesNothingAndRecordsNothing()
    {
        await database.ResetAsync();
        var visitor = new string('c', 43);
        await using (var seed = database.CreateContext())
        {
            var day = new DateOnly(2026, 11, 17);
            seed.AnalyticsVisits.Add(AnalyticsVisit.Start(VisitorKey.HashVisitor(visitor), day, new DateTimeOffset(2026, 11, 17, 2, 0, 0, TimeSpan.Zero), ReferrerName.Direct, DeviceKind.Computer, "Chrome", "Windows", null));
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var factory = new RealLimitsFactory(database.ConnectionString, new Dictionary<string, string> { ["RateLimits:AnalyticsClear:PermitLimit"] = "1" })
        {
            RemoteIpFromHeader = true,
        };
        using var client = ConsentEndpointTests.NewClient(factory);

        using var accepted = await PostClearAsync(client, "203.0.113.84");
        using var rejected = await PostClearAsync(client, "203.0.113.84", $"{AnalyticsCookies.VisitorCookieName}={visitor}");

        accepted.StatusCode.ShouldBe(HttpStatusCode.OK);
        rejected.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        await using var context = database.CreateContext();
        context.AnalyticsVisits.Count().ShouldBe(1);
        context.ConsentRecords.Count().ShouldBe(1);
        ConsentEndpointTests.SetCookieOf(rejected, AnalyticsCookies.VisitorCookieName).ShouldBeNull();
        ConsentEndpointTests.SetCookieOf(rejected, AnalyticsCookies.ConsentCookieName).ShouldBeNull();
    }

    [Fact]
    public void TheClearDefaultIsFiveAMinuteInTheAnalyticsClearSection()
    {
        var rule = AnalyticsClearRateLimit.Default();

        (rule.PermitLimit, rule.Window).ShouldBe((5, TimeSpan.FromMinutes(1)));
        AnalyticsClearRateLimit.Validate(rule).ShouldBeEmpty();
        AnalyticsClearRateLimit.SectionName.ShouldBe("RateLimits:AnalyticsClear");
        RateLimitPolicies.AnalyticsClear.ShouldBe("analytics-clear");
    }

    [Fact]
    public void AnUnusableClearLimitIsNamedAndNeverEchoed()
    {
        var problems = AnalyticsClearRateLimit.Validate(new RateLimitRule { PermitLimit = 0, Window = TimeSpan.FromSeconds(1) });

        problems.ShouldBe(["RateLimits:AnalyticsClear:PermitLimit must be at least 1.", "RateLimits:AnalyticsClear:Window must be at least 6 seconds."]);
    }

    [Fact]
    public async Task AHostWithAnUnusableClearLimitDoesNotStartAndNamesTheSetting()
    {
        await using var factory = new RealLimitsFactory(new Dictionary<string, string> { ["RateLimits:AnalyticsClear:PermitLimit"] = "0" });

        var failure = Should.Throw<InvalidOperationException>(() => factory.CreateClient());

        failure.Message.ShouldContain("RateLimits:AnalyticsClear:PermitLimit must be at least 1.");
    }

    private static async Task<HttpResponseMessage> PostClearAsync(HttpClient client, string address, string? cookies = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri("/api/v1/analytics/clear", UriKind.Relative));
        request.Headers.Add(RequireCsrfHeaderAttribute.HeaderName, "1");
        request.Headers.Add(RemoteIpStartupFilter.HeaderName, address);
        if (cookies is not null)
        {
            request.Headers.TryAddWithoutValidation("Cookie", cookies);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> PostPageViewAsync(HttpClient client, string address)
    {
        using var request = PageViewCollectTests.NewPost(PageViewCollectTests.PathBody("/gallery"));
        request.Headers.Add(RemoteIpStartupFilter.HeaderName, address);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> PostAsync(HttpClient client, string address)
    {
        using var request = ConsentEndpointTests.NewPost(ConsentEndpointTests.AcceptAll());
        request.Headers.Add(RemoteIpStartupFilter.HeaderName, address);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
