using System.Net;
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

    [Fact]
    public async Task APageViewExpiresTheOldVisitorId()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);
        using var request = AnalyticsHttp.NewPost(PageViewRoute, "{\"path\":\"/gallery\"}");
        request.Headers.Add("Cookie", $"{AnalyticsCookies.VisitorCookieName}=x");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        AssertVisitorIdExpired(AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.VisitorCookieName));
    }

    private static void AssertVisitorIdExpired(string? setCookie)
    {
        setCookie.ShouldNotBeNull("the answer must carry a delete for the visitor id");
        AnalyticsHttp.ValueOf(setCookie).ShouldBeEmpty();
        var text = setCookie.ToLowerInvariant();
        text.ShouldContain("; path=/api/v1/analytics");
        text.ShouldContain("; secure");
        text.ShouldContain("; samesite=strict");
        text.ShouldContain("; httponly");
        text.ShouldNotContain("domain=");
        AnalyticsHttp.ExpiresOf(setCookie).ShouldBeLessThan(TimeProvider.System.GetUtcNow());
    }
}
