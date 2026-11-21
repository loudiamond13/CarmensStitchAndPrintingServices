using System.Globalization;
using System.Net;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.Security;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Analytics;

/// <summary>
/// ANL-05, ANL-06, D-21: <c>POST /api/v1/analytics/page-views</c> adds one to the anonymous count of the page for the business day. Nothing
/// else is stored, and no cookie is set.
/// </summary>
public sealed class PageViewCollectTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    internal const string Route = "/api/v1/analytics/page-views";
    internal const string DesktopChrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

    [Fact]
    public async Task AGalleryViewFromADesktopBrowserCountsOneForTodayAndSetsNoCookie()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);
        var before = await BusinessDayAsync(factory);

        using var response = await PostAsync(client, PathBody("/gallery"));

        var after = await BusinessDayAsync(factory);
        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty();
        response.Headers.Contains("Set-Cookie").ShouldBeFalse("the anonymous count sets no cookie");
        var row = (await ReadRowsAsync()).ShouldHaveSingleItem();
        row.PageKey.ShouldBe("gallery");
        row.Views.ShouldBe(1);
        row.BusinessDay.ShouldBeOneOf(before, after);
    }

    [Fact]
    public async Task TheSecondViewOfTheSamePageAddsOneToTheSameRow()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var first = await PostAsync(client, PathBody("/"));
        using var second = await PostAsync(client, PathBody("/"));

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var row = (await ReadRowsAsync()).ShouldHaveSingleItem();
        row.PageKey.ShouldBe("home");
        row.Views.ShouldBe(2);
    }

    [Fact]
    public async Task ACallWithoutTheAntiCsrfHeaderIs403AndCountsNothing()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostAsync(client, PathBody("/gallery"), csrf: false);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ReadRowsAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task ACraftedPathWithAQueryAndAFragmentCountsAsTheGalleryAndNoTableHoldsTheRawPath()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostAsync(client, PathBody("/gallery?q=secret#x"));

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var row = (await ReadRowsAsync()).ShouldHaveSingleItem();
        row.PageKey.ShouldBe("gallery");
        row.Views.ShouldBe(1);
        await using var context = database.CreateContext();
        (await context.DailyPageCounts.AsNoTracking().Select(count => count.PageKey).ToListAsync(TestContext.Current.CancellationToken))
            .ShouldAllBe(key => !key.Contains('?', StringComparison.Ordinal) && !key.Contains('#', StringComparison.Ordinal) && !key.Contains("secret", StringComparison.Ordinal));
    }

    [Fact]
    public async Task AnUnknownPublicPathCountsAsNotFoundAndManyUnknownPathsShareOneRow()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var first = await PostAsync(client, PathBody("/nope"));
        using var second = await PostAsync(client, PathBody("/wp-login.php"));
        using var third = await PostAsync(client, PathBody("/a/b/c/d"));

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        third.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var row = (await ReadRowsAsync()).ShouldHaveSingleItem();
        row.PageKey.ShouldBe("not-found");
        row.Views.ShouldBe(3);
    }

    [Theory]
    [InlineData("/admin")]
    [InlineData("/admin/orders")]
    [InlineData("/dev/preview")]
    public async Task AnAdminOrDevPathStoresNothingAndStillAnswers204(string path)
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostAsync(client, PathBody(path));

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await ReadRowsAsync()).ShouldBeEmpty();
    }

    [Theory]
    [InlineData("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")]
    [InlineData("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36")]
    [InlineData(null)]
    public async Task ABotAndAMissingUserAgentStoreNothingAndStillAnswer204(string? userAgent)
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostAsync(client, PathBody("/gallery"), userAgent);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await ReadRowsAsync()).ShouldBeEmpty();
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("{\"path\":\"\"}")]
    [InlineData("{\"path\":\"gallery\"}")]
    [InlineData("{\"path\":null}")]
    [InlineData("not json")]
    [InlineData("")]
    public async Task ABodyWithNoUsablePathIs400NamingThePathAndStoresNothing(string json)
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostAsync(client, json);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").TryGetProperty("path", out _).ShouldBeTrue("the 400 must name path");
        (await ReadRowsAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task NoLogLineHoldsThePathTheReferrerTheUserAgentOrACookieValue()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);
        const string Marker = "zq7marker91";
        using var counted = NewPost($"{{\"path\":\"/gallery?{Marker}-query#{Marker}-fragment\",\"referrerHost\":\"{Marker}.example\"}}", $"{DesktopChrome} {Marker}-agent");
        counted.Headers.Add("Cookie", $"__Secure-csps_vid={Marker}-visitor; __Host-csps_consent={Marker}-consent");
        using var dropped = NewPost($"{{\"path\":\"/{Marker}-dropped\"}}", $"{Marker}-bot Googlebot/2.1");

        using var first = await client.SendAsync(counted, TestContext.Current.CancellationToken);
        using var second = await client.SendAsync(dropped, TestContext.Current.CancellationToken);

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await Task.Delay(TimeSpan.FromMilliseconds(500), TestContext.Current.CancellationToken);
        var lines = factory.Sink.Events.Select(logEvent => logEvent.RenderMessage(CultureInfo.InvariantCulture) + " " + string.Join(' ', logEvent.Properties.Values.Select(value => value.ToString())) + " " + logEvent.Exception).ToList();
        lines.ShouldNotBeEmpty();
        lines.ShouldAllBe(line => !line.Contains(Marker, StringComparison.Ordinal));
    }

    [Fact]
    public async Task AStaffMemberSignedInInTheSameBrowserIsNotCountedNotEvenAnonymously()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        await AuthClient.SignInFullyAsync(client, staff);

        using var response = await PostAsync(client, PathBody("/gallery"));

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await ReadRowsAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task AfterSignOutTheSameBrowserIsCountedAgain()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        await AuthClient.SignInFullyAsync(client, staff);
        using var signOut = await AuthClient.SignOutAsync(client);
        signOut.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var response = await PostAsync(client, PathBody("/gallery"));

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await ReadRowsAsync()).ShouldHaveSingleItem().Views.ShouldBe(1);
    }

    [Theory]
    [InlineData("1")]
    [InlineData("anything")]
    public async Task TheStaffMarkerCookieAloneStopsTheCountWhateverItsValue(string value)
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);
        using var request = NewPost(PathBody("/gallery"));
        request.Headers.Add("Cookie", $"{AnalyticsCookies.StaffCookieName}={value}");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await ReadRowsAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task ABearerTokenAloneStopsTheCount()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);
        using var request = NewPost(PathBody("/gallery"));
        request.Headers.TryAddWithoutValidation("Authorization", "Bearer not-a-real-token");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await ReadRowsAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task ASignedInStaffRequestWithABadBodyIsStill400()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);
        using var request = NewPost("{}");
        request.Headers.Add("Cookie", $"{AnalyticsCookies.StaffCookieName}=1");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task OldCookiesWriteNoVisitRows()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);
        var day = (await BusinessDayAsync(factory)).ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        using var request = NewPost(PathBody("/gallery"));
        request.Headers.Add("Cookie", $"__Secure-csps_vid={OldVisitorId}; __Host-csps_consent=1_0a1b2c3d4e5f4a6b8c7d9e0f1a2b3c4d_1.0_1_1_{day}");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var row = (await ReadRowsAsync()).ShouldHaveSingleItem();
        row.PageKey.ShouldBe("gallery");
        row.Views.ShouldBe(1);
        await using var context = database.CreateContext();
        (await context.AnalyticsVisits.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.AnalyticsPageViews.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.AnalyticsVitalSamples.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AnExtraReferrerHostPropertyStillCounts()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostAsync(client, "{\"path\":\"/gallery\",\"referrerHost\":\"m.facebook.com\"}");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var row = (await ReadRowsAsync()).ShouldHaveSingleItem();
        row.PageKey.ShouldBe("gallery");
        row.Views.ShouldBe(1);
    }

    [Fact]
    public async Task ABodyOverTheCapIs413AndCountsNothing()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostAsync(client, BodyOfBytes(BodyCap + 1));

        response.StatusCode.ShouldBe(HttpStatusCode.RequestEntityTooLarge);
        (await ReadRowsAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task ABodyOfExactlyTheCapIsNotRefusedForItsSize()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostAsync(client, BodyOfBytes(BodyCap));

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var row = (await ReadRowsAsync()).ShouldHaveSingleItem();
        row.PageKey.ShouldBe("not-found");
    }

    // The limit on the beacon route (RequestSizeLimitMetadata on AnalyticsController.RecordPageView).
    private const int BodyCap = 2048;

    // A well-formed path body of exactly this many bytes: {"path":"/aaa..."}.
    private static string BodyOfBytes(int bytes)
    {
        const string Open = "{\"path\":\"/";
        const string Close = "\"}";
        return Open + new string('a', bytes - Open.Length - Close.Length) + Close;
    }

    private const string OldVisitorId = "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv";

    internal static string PathBody(string path) => $"{{\"path\":\"{path}\"}}";

    // The page view post with a desktop browser User-Agent unless another is given.
    internal static HttpRequestMessage NewPost(string json, string? userAgent = DesktopChrome, bool csrf = true) =>
        AnalyticsHttp.NewPost(Route, json, csrf, userAgent);

    internal static async Task<HttpResponseMessage> PostAsync(HttpClient client, string json, string? userAgent = DesktopChrome, bool csrf = true)
    {
        using var request = NewPost(json, userAgent, csrf);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    internal static async Task<DateOnly> BusinessDayAsync(WebApplicationFactory<Program> factory)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var clock = await scope.ServiceProvider.GetRequiredService<IBusinessCalendar>().GetClockAsync(TestContext.Current.CancellationToken);
        return clock.Today;
    }

    private async Task<List<DailyPageCount>> ReadRowsAsync()
    {
        await using var context = database.CreateContext();
        return await context.DailyPageCounts.AsNoTracking().OrderBy(row => row.PageKey).ToListAsync(TestContext.Current.CancellationToken);
    }
}
