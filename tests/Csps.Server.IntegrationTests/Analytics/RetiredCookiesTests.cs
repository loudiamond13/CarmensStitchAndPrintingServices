using System.Net;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.Security;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Analytics;

/// <summary>
/// D-63: a browser that still holds the old visitor id or consent cookie (a test browser from Phase 12) gets them expired by the first
/// answer it receives, with exactly the attributes they were set with. No other cookie is touched.
/// </summary>
public sealed class RetiredCookiesTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string PageViewRoute = "/api/v1/analytics/page-views";
    private const string PageViewBody = "{\"path\":\"/gallery\"}";

    [Fact]
    public async Task APageViewExpiresTheOldVisitorId()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);
        using var request = AnalyticsHttp.NewPost(PageViewRoute, PageViewBody);
        request.Headers.Add("Cookie", $"{AnalyticsCookies.VisitorCookieName}=x");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        AssertExpired(AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.VisitorCookieName), "/api/v1/analytics", "strict", httpOnly: true);
    }

    [Fact]
    public async Task TheShellExpiresTheOldConsentCookie()
    {
        await using var factory = new ShellTestFactory();
        using var client = AnalyticsHttp.NewClient(factory);
        using var request = ApiRequests.Get("/");
        request.Headers.Add("Cookie", $"{AnalyticsCookies.ConsentCookieName}=x");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        AssertExpired(AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.ConsentCookieName), "/", "lax", httpOnly: false);
    }

    [Fact]
    public async Task AnApiAnswerExpiresTheOldConsentCookie()
    {
        await using var factory = new ShellTestFactory();
        using var client = AnalyticsHttp.NewClient(factory);
        using var request = ApiRequests.Get("/api/v1/public/site");
        request.Headers.Add("Cookie", $"{AnalyticsCookies.ConsentCookieName}=x");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        AssertExpired(AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.ConsentCookieName), "/", "lax", httpOnly: false);
    }

    [Fact]
    public async Task AStaticAssetGetsNoCookieDelete()
    {
        await using var factory = new CspsApiFactory();
        using var client = AnalyticsHttp.NewClient(factory);
        using var request = ApiRequests.Get("/assets/app-fixture.js");
        request.Headers.Add("Cookie", $"{AnalyticsCookies.ConsentCookieName}=x; {AnalyticsCookies.VisitorCookieName}=x");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.Contains("Set-Cookie").ShouldBeFalse("a hashed, long-cached asset never carries a Set-Cookie");
    }

    [Fact]
    public async Task NoOldCookieMeansNoDelete()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);
        using var request = AnalyticsHttp.NewPost(PageViewRoute, PageViewBody);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.ConsentCookieName).ShouldBeNull();
        AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.VisitorCookieName).ShouldBeNull();
        response.Headers.Contains("Set-Cookie").ShouldBeFalse();
    }

    [Fact]
    public async Task OtherCookiesAreNeverExpired()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);
        using var request = AnalyticsHttp.NewPost(PageViewRoute, PageViewBody);
        request.Headers.Add(
            "Cookie",
            $"{AuthCookies.RefreshCookieName}=a; {AuthCookies.TicketCookieName}=b; {AnalyticsCookies.StaffCookieName}=1; "
            + $"{AnalyticsCookies.ConsentCookieName}=c; {AnalyticsCookies.VisitorCookieName}=d");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var names = response.Headers.TryGetValues("Set-Cookie", out var values)
            ? values.Select(value => value.Split('=')[0]).Order(StringComparer.Ordinal).ToList()
            : [];
        names.ShouldBe([AnalyticsCookies.ConsentCookieName, AnalyticsCookies.VisitorCookieName]);
    }

    [Fact]
    public async Task ARejectedPageViewStillExpiresTheOldCookies()
    {
        await using var factory = new CspsApiFactory();
        using var client = AnalyticsHttp.NewClient(factory);
        using var request = AnalyticsHttp.NewPost(PageViewRoute, PageViewBody, csrf: false);
        request.Headers.Add("Cookie", $"{AnalyticsCookies.ConsentCookieName}=x; {AnalyticsCookies.VisitorCookieName}=x");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        AssertExpired(AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.VisitorCookieName), "/api/v1/analytics", "strict", httpOnly: true);
        AssertExpired(AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.ConsentCookieName), "/", "lax", httpOnly: false);
    }

    private static void AssertExpired(string? setCookie, string path, string sameSite, bool httpOnly)
    {
        setCookie.ShouldNotBeNull("the answer must carry a delete for the retired cookie");
        AnalyticsHttp.ValueOf(setCookie).ShouldBeEmpty();
        var attributes = setCookie.Split(';').Skip(1).Select(part => part.Trim().ToLowerInvariant()).ToList();
        attributes.ShouldContain($"path={path}");
        attributes.ShouldContain("secure");
        attributes.ShouldContain($"samesite={sameSite}");
        attributes.Contains("httponly").ShouldBe(httpOnly, "httponly must match how the cookie was set");
        attributes.ShouldNotContain(attribute => attribute.StartsWith("domain=", StringComparison.Ordinal));
        AnalyticsHttp.ExpiresOf(setCookie).ShouldBeLessThan(TimeProvider.System.GetUtcNow());
    }
}
