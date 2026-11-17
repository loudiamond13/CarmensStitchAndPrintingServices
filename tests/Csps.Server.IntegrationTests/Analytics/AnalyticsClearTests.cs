using System.Net;
using System.Text;
using System.Text.Json;
using Csps.Application.Analytics;
using Csps.Domain.Analytics;
using Csps.Domain.Content;
using Csps.Server.Security;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Analytics;

/// <summary>
/// ANL-04, D-19, D-31, D-41, CWE-639: <c>POST /api/v1/analytics/clear</c> deletes the rows of the visitor the HttpOnly cookie names, expires
/// that cookie, logs a reset decision and sets the consent cookie. It touches nothing else.
/// </summary>
public sealed class AnalyticsClearTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/analytics/clear";
    private static readonly string VisitorA = new('a', 43);
    private static readonly string VisitorB = new('b', 43);
    private static readonly DateOnly Day = new(2026, 11, 17);
    private static readonly DateTimeOffset Start = new(2026, 11, 17, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task ClearRemovesTheCallersVisitsPageViewsAndSamplesAndKeepsAnotherVisitorsRows()
    {
        await database.ResetAsync();
        await SeedVisitorAsync(VisitorA);
        await SeedVisitorAsync(VisitorB);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = ConsentEndpointTests.NewClient(factory);

        using var response = await PostAsync(client, VisitorCookie(VisitorA));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        var visits = await context.AnalyticsVisits.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken);
        visits.ShouldHaveSingleItem().VisitorHash.ShouldBe(VisitorKey.HashVisitor(VisitorB));
        (await context.AnalyticsPageViews.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
        (await context.AnalyticsVitalSamples.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task ClearLogsOneResetDecisionWithSourceClearAndSetsTheConsentCookieWithBothOff()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = ConsentEndpointTests.NewClient(factory);

        using var response = await PostAsync(client, VisitorCookie(VisitorA));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        var record = (await context.ConsentRecords.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem();
        record.Source.ShouldBe(ConsentSource.Clear);
        record.Stats.ShouldBe(false);
        record.Map.ShouldBeFalse();
        record.Gpc.ShouldBeFalse();
        record.PolicyVersion.ShouldBe(LegalPages.CookiePolicyVersion);
        var cookie = ConsentEndpointTests.SetCookieOf(response, AnalyticsCookies.ConsentCookieName).ShouldNotBeNull();
        var attributes = cookie.ToLowerInvariant();
        attributes.ShouldContain("; path=/");
        attributes.ShouldNotContain("; path=/api");
        attributes.ShouldContain("; secure");
        attributes.ShouldContain("; samesite=lax");
        attributes.ShouldNotContain("httponly");
        ConsentCookie.TryParse(ConsentEndpointTests.ValueOf(cookie), out var parsed).ShouldBeTrue();
        parsed!.Pending.ShouldBeFalse();
        parsed.ConsentId.ShouldBe(record.ConsentId);
        parsed.Stats.ShouldBe(false);
        parsed.Map.ShouldBeFalse();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.EnumerateObject().Select(property => property.Name).ShouldBe(["consentId", "policyVersion", "stats", "map", "gpc", "decidedOn"]);
        document.RootElement.GetProperty("consentId").GetString().ShouldBe(record.ConsentId.ToString("N"));
        document.RootElement.GetProperty("stats").GetBoolean().ShouldBeFalse();
        document.RootElement.GetProperty("map").GetBoolean().ShouldBeFalse();
    }

    [Fact]
    public async Task ClearExpiresTheVisitorIdWithItsOwnPathAndAttributes()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = ConsentEndpointTests.NewClient(factory);

        using var response = await PostAsync(client, VisitorCookie(VisitorA));

        AssertVisitorExpired(response);
    }

    [Fact]
    public async Task TheAnswerIsTheSameWhetherOrNotACookieWasPresentOrAnythingWasDeleted()
    {
        await database.ResetAsync();
        await SeedVisitorAsync(VisitorA);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = ConsentEndpointTests.NewClient(factory);

        using var held = await PostAsync(client, VisitorCookie(VisitorA));
        using var again = await PostAsync(client, VisitorCookie(VisitorA));
        using var none = await PostAsync(client, null);
        using var unknown = await PostAsync(client, VisitorCookie(VisitorB));
        using var malformed = await PostAsync(client, VisitorCookie("not-a-visitor-id"));

        foreach (var response in new[] { held, again, none, unknown, malformed })
        {
            response.StatusCode.ShouldBe(HttpStatusCode.OK);
            AssertVisitorExpired(response);
            ConsentEndpointTests.SetCookieOf(response, AnalyticsCookies.ConsentCookieName).ShouldNotBeNull();
        }
    }

    [Fact]
    public async Task EveryCallLogsADecisionEvenWhenThereWasNothingToDelete()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = ConsentEndpointTests.NewClient(factory);

        using var first = await PostAsync(client, null);
        using var second = await PostAsync(client, null);

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        var records = await context.ConsentRecords.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken);
        records.Count.ShouldBe(2);
        records.Select(record => record.ConsentId).Distinct().Count().ShouldBe(2);
    }

    [Fact]
    public async Task ThePageCountsWithNoVisitorIdAreUntouched()
    {
        await database.ResetAsync();
        await SeedVisitorAsync(VisitorA);
        await using (var context = database.CreateContext())
        {
            context.DailyPageCounts.Add(DailyPageCount.First(Day, PageKeys.Gallery));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = ConsentEndpointTests.NewClient(factory);

        using var response = await PostAsync(client, VisitorCookie(VisitorA));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var check = database.CreateContext();
        (await check.DailyPageCounts.SumAsync(row => row.Views, TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task TheStaffMarkerAndTheRefreshCookieAreNeitherReadNorTouched()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = ConsentEndpointTests.NewClient(factory);
        var cookies = $"{VisitorCookie(VisitorA)}; {AuthCookies.RefreshCookieName}=refresh-value; {AnalyticsCookies.StaffCookieName}=1";

        using var response = await PostAsync(client, cookies);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        ConsentEndpointTests.SetCookieOf(response, AuthCookies.RefreshCookieName).ShouldBeNull();
        ConsentEndpointTests.SetCookieOf(response, AnalyticsCookies.StaffCookieName).ShouldBeNull();
        var setCookies = response.Headers.GetValues("Set-Cookie").ToList();
        setCookies.Count.ShouldBe(2);
        setCookies.ShouldAllBe(value => value.StartsWith(AnalyticsCookies.VisitorCookieName + "=", StringComparison.Ordinal)
            || value.StartsWith(AnalyticsCookies.ConsentCookieName + "=", StringComparison.Ordinal));
        response.Headers.Contains("Clear-Site-Data").ShouldBeFalse("a header that wipes every cookie of the site is never sent");
    }

    [Fact]
    public async Task UnderGpcTheDecisionStoresTheGpcFlag()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = ConsentEndpointTests.NewClient(factory);
        using var request = NewRequest(null);
        request.Headers.Add("Sec-GPC", "1");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        (await context.ConsentRecords.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken)).Gpc.ShouldBeTrue();
    }

    [Fact]
    public async Task ACallWithoutTheAntiCsrfHeaderIs403AndDeletesNothing()
    {
        await database.ResetAsync();
        await SeedVisitorAsync(VisitorA);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = ConsentEndpointTests.NewClient(factory);
        using var request = NewRequest(VisitorCookie(VisitorA), csrf: false);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        await using var context = database.CreateContext();
        (await context.AnalyticsVisits.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
        (await context.ConsentRecords.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        ConsentEndpointTests.SetCookieOf(response, AnalyticsCookies.VisitorCookieName).ShouldBeNull();
    }

    [Fact]
    public async Task AnIdInTheBodyIsIgnoredAndOnlyTheCookieChoosesTheVisitor()
    {
        await database.ResetAsync();
        await SeedVisitorAsync(VisitorA);
        await SeedVisitorAsync(VisitorB);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = ConsentEndpointTests.NewClient(factory);
        using var request = NewRequest(VisitorCookie(VisitorA));
        request.Content = new StringContent($"{{\"visitorId\":\"{VisitorB}\"}}", Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        (await context.AnalyticsVisits.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken)).VisitorHash.ShouldBe(VisitorKey.HashVisitor(VisitorB));
    }

    private static string VisitorCookie(string token) => $"{AnalyticsCookies.VisitorCookieName}={token}";

    private static void AssertVisitorExpired(HttpResponseMessage response)
    {
        var cookie = ConsentEndpointTests.SetCookieOf(response, AnalyticsCookies.VisitorCookieName).ShouldNotBeNull();
        ConsentEndpointTests.ValueOf(cookie).ShouldBeEmpty();
        var attributes = cookie.ToLowerInvariant();
        attributes.ShouldContain("; path=/api/v1/analytics");
        attributes.ShouldContain("; secure");
        attributes.ShouldContain("; samesite=strict");
        attributes.ShouldContain("; httponly");
        ConsentEndpointTests.ExpiresOf(cookie).ShouldBeLessThan(TimeProvider.System.GetUtcNow());
    }

    private static HttpRequestMessage NewRequest(string? cookies, bool csrf = true)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, new Uri(Route, UriKind.Relative));
        if (csrf)
        {
            request.Headers.Add(RequireCsrfHeaderAttribute.HeaderName, "1");
        }

        if (cookies is not null)
        {
            request.Headers.TryAddWithoutValidation("Cookie", cookies);
        }

        return request;
    }

    private static async Task<HttpResponseMessage> PostAsync(HttpClient client, string? cookies)
    {
        using var request = NewRequest(cookies);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private async Task SeedVisitorAsync(string token)
    {
        await using var context = database.CreateContext();
        var visit = AnalyticsVisit.Start(VisitorKey.HashVisitor(token), Day, Start, ReferrerName.Direct, DeviceKind.Computer, "Chrome", "Windows", null);
        context.AnalyticsVisits.Add(visit);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        context.AnalyticsPageViews.Add(AnalyticsPageView.Of(visit.Id, Day, Start, PageKeys.Gallery));
        context.AnalyticsVitalSamples.Add(AnalyticsVitalSample.Of(visit.Id, Day, VitalMetric.Lcp, 2100m, PageKeys.Gallery));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }
}
