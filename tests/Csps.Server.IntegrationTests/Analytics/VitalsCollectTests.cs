using System.Net;
using System.Text;
using Csps.Domain.Analytics;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.Security;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Analytics;

/// <summary>
/// ANL-05, D-26, D-41: <c>POST /api/v1/analytics/vitals</c> stores a consented visitor's speed samples against the current visit, drops each
/// out-of-range metric, and stores nothing for anyone else. Every well-formed call answers 204.
/// </summary>
public sealed class VitalsCollectTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/analytics/vitals";
    private const string FullReport = "{\"path\":\"/contact?x=1#y\",\"lcp\":2100,\"cls\":0.04,\"inp\":180}";

    [Fact]
    public async Task AConsentedVisitorsThreeMetricsAreStoredAgainstTheirVisitWithTheContactKey()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = PageViewCollectTests.NewClient(factory);
        var cookie = await PageViewCollectTests.ConsentedCookieAsync(factory);
        using var view = await PageViewCollectTests.PostWithCookieAsync(client, PageViewCollectTests.PathBody("/contact"), cookie);
        view.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var response = await PostAsync(client, FullReport, cookie);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty();
        await using var context = database.CreateContext();
        var visit = (await context.AnalyticsVisits.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem();
        var samples = await context.AnalyticsVitalSamples.AsNoTracking().OrderBy(sample => sample.Metric).ToListAsync(TestContext.Current.CancellationToken);
        samples.Select(sample => (sample.Metric, sample.Value)).ShouldBe([(VitalMetric.Lcp, 2100m), (VitalMetric.Cls, 0.04m), (VitalMetric.Inp, 180m)]);
        samples.ShouldAllBe(sample => sample.VisitId == visit.Id && sample.PageKey == "contact");
        visit.PageViews.ShouldBe(1);
    }

    [Fact]
    public async Task AnOutOfRangeMetricIsDroppedAndTheOtherTwoAreKept()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = PageViewCollectTests.NewClient(factory);
        var cookie = await PageViewCollectTests.ConsentedCookieAsync(factory);
        using var view = await PageViewCollectTests.PostWithCookieAsync(client, PageViewCollectTests.PathBody("/"), cookie);

        using var response = await PostAsync(client, "{\"path\":\"/\",\"lcp\":70000,\"cls\":0.04,\"inp\":180}", cookie);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        (await context.AnalyticsVitalSamples.AsNoTracking().OrderBy(sample => sample.Metric).Select(sample => sample.Metric).ToListAsync(TestContext.Current.CancellationToken))
            .ShouldBe([VitalMetric.Cls, VitalMetric.Inp]);
    }

    [Fact]
    public async Task WithNoCurrentVisitNothingIsStoredAndTheAnswerIs204()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = PageViewCollectTests.NewClient(factory);

        using var response = await PostAsync(client, FullReport, await PageViewCollectTests.ConsentedCookieAsync(factory));

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await AssertNothingStoredAsync();
    }

    [Theory]
    [InlineData("rejected")]
    [InlineData("gpc")]
    [InlineData("bot")]
    [InlineData("staff")]
    [InlineData("no-vid")]
    public async Task OtherCallersStoreNothingAndStillGet204(string scenario)
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = PageViewCollectTests.NewClient(factory);
        var consented = await PageViewCollectTests.ConsentedCookieAsync(factory);
        using var view = await PageViewCollectTests.PostWithCookieAsync(client, PageViewCollectTests.PathBody("/"), consented);
        var day = await PageViewCollectTests.BusinessDayAsync(factory);
        var cookie = scenario switch
        {
            "rejected" => $"__Secure-csps_vid={PageViewCollectTests.Vid}; __Host-csps_consent={PageViewCollectTests.ConsentValue(false, day)}",
            "no-vid" => $"__Host-csps_consent={PageViewCollectTests.ConsentValue(true, day)}",
            "staff" => $"{consented}; {AnalyticsCookies.StaffCookieName}=1",
            _ => consented,
        };
        using var request = NewPost(FullReport, scenario == "bot" ? "Mozilla/5.0 (compatible; Googlebot/2.1)" : PageViewCollectTests.DesktopChrome);
        request.Headers.Add("Cookie", cookie);
        if (scenario == "gpc")
        {
            request.Headers.Add("Sec-GPC", "1");
        }

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        (await context.AnalyticsVitalSamples.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task TheSamplesStayWhenTheVisitorLaterTurnsStatsOff()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = PageViewCollectTests.NewClient(factory);
        var cookie = await PageViewCollectTests.ConsentedCookieAsync(factory);
        using var view = await PageViewCollectTests.PostWithCookieAsync(client, PageViewCollectTests.PathBody("/"), cookie);
        using var first = await PostAsync(client, FullReport, cookie);
        var day = await PageViewCollectTests.BusinessDayAsync(factory);

        using var off = await PostAsync(client, FullReport, $"__Secure-csps_vid={PageViewCollectTests.Vid}; __Host-csps_consent={PageViewCollectTests.ConsentValue(false, day)}");

        off.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        (await context.AnalyticsVitalSamples.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(3);
    }

    [Fact]
    public async Task ACallWithoutTheAntiCsrfHeaderIs403AndStoresNothing()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = PageViewCollectTests.NewClient(factory);
        using var request = NewPost(FullReport, csrf: false);
        request.Headers.Add("Cookie", await PageViewCollectTests.ConsentedCookieAsync(factory));

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        await AssertNothingStoredAsync();
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("{\"path\":\"\"}")]
    [InlineData("{\"path\":\"contact\"}")]
    [InlineData("not json")]
    [InlineData("")]
    public async Task ABodyWithNoUsablePathIs400NamingThePath(string json)
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = PageViewCollectTests.NewClient(factory);

        using var response = await PostAsync(client, json, null);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").TryGetProperty("path", out _).ShouldBeTrue("the 400 must name path");
    }

    [Fact]
    public async Task ABodyOver2KbIsRefusedAndStoresNothing()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = PageViewCollectTests.NewClient(factory);
        var body = "{\"path\":\"/" + new string('a', 3000) + "\",\"lcp\":2100}";

        using var response = await PostAsync(client, body, await PageViewCollectTests.ConsentedCookieAsync(factory));

        ((int)response.StatusCode).ShouldBeGreaterThanOrEqualTo(400);
        await AssertNothingStoredAsync();
    }

    [Fact]
    public async Task AStaffMemberSignedInInTheSameBrowserStoresNothing()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        await AuthClient.SignInFullyAsync(client, staff);

        using var response = await PostAsync(client, FullReport, await PageViewCollectTests.ConsentedCookieAsync(factory));

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await AssertNothingStoredAsync();
    }

    private static HttpRequestMessage NewPost(string json, string? userAgent = PageViewCollectTests.DesktopChrome, bool csrf = true)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, new Uri(Route, UriKind.Relative))
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
        };
        if (csrf)
        {
            request.Headers.Add(RequireCsrfHeaderAttribute.HeaderName, "1");
        }

        if (userAgent is not null)
        {
            request.Headers.TryAddWithoutValidation("User-Agent", userAgent);
        }

        return request;
    }

    private static async Task<HttpResponseMessage> PostAsync(HttpClient client, string json, string? cookie)
    {
        using var request = NewPost(json);
        if (cookie is not null)
        {
            request.Headers.Add("Cookie", cookie);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private async Task AssertNothingStoredAsync()
    {
        await using var context = database.CreateContext();
        (await context.AnalyticsVitalSamples.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.AnalyticsVisits.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }
}
