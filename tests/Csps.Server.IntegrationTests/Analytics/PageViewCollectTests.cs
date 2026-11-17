using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Domain.Content;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.Security;
using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;

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
        using var client = NewClient(factory);
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
        using var client = NewClient(factory);

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
        using var client = NewClient(factory);

        using var response = await PostAsync(client, PathBody("/gallery"), csrf: false);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ReadRowsAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task ACraftedPathWithAQueryAndAFragmentCountsAsTheGalleryAndNoTableHoldsTheRawPath()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = NewClient(factory);

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
        using var client = NewClient(factory);

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
        using var client = NewClient(factory);

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
        using var client = NewClient(factory);

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
        using var client = NewClient(factory);

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
        using var client = NewClient(factory);
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
        using var client = NewClient(factory);
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
        using var client = NewClient(factory);
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
        using var client = NewClient(factory);
        using var request = NewPost("{}");
        request.Headers.Add("Cookie", $"{AnalyticsCookies.StaffCookieName}=1");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AVisitorWhoAcceptedStatsOpensTwoPagesAndOneVisitWithTwoPageViewsIsRecorded()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = NewClient(factory);
        var cookie = await ConsentedCookieAsync(factory);

        using var first = await PostWithCookieAsync(client, PathBody("/"), cookie);
        using var second = await PostWithCookieAsync(client, PathBody("/gallery"), cookie);

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        var visit = (await context.AnalyticsVisits.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem();
        visit.PageViews.ShouldBe(2);
        visit.VisitorHash.ShouldBe(SHA256.HashData(Encoding.UTF8.GetBytes(Vid)));
        visit.Referrer.ShouldBe("Direct");
        visit.Device.ShouldBe(DeviceKind.Computer);
        visit.Browser.ShouldBe("Chrome");
        visit.Os.ShouldBe("Windows");
        visit.LastSeenAtUtc.ShouldBeGreaterThanOrEqualTo(visit.StartedAtUtc);
        var views = await context.AnalyticsPageViews.AsNoTracking().OrderBy(view => view.Id).ToListAsync(TestContext.Current.CancellationToken);
        views.Select(view => view.PageKey).ShouldBe(["home", "gallery"]);
        views.ShouldAllBe(view => view.VisitId == visit.Id);
        (await ReadRowsAsync()).Sum(row => row.Views).ShouldBe(2);
    }

    [Theory]
    [InlineData("no-vid")]
    [InlineData("rejected")]
    [InlineData("not-chosen")]
    [InlineData("gpc")]
    [InlineData("malformed-vid")]
    [InlineData("pending")]
    [InlineData("unreadable-consent")]
    public async Task WithoutTheVidAnAcceptedChoiceAndNoGpcOnlyTheAnonymousCountChanges(string scenario)
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = NewClient(factory);
        var day = await BusinessDayAsync(factory);
        var cookie = scenario switch
        {
            "no-vid" => $"__Host-csps_consent={ConsentValue(true, day)}",
            "rejected" => $"__Secure-csps_vid={Vid}; __Host-csps_consent={ConsentValue(false, day)}",
            "not-chosen" => $"__Secure-csps_vid={Vid}; __Host-csps_consent={ConsentValue(null, day)}",
            "malformed-vid" => $"__Secure-csps_vid=short; __Host-csps_consent={ConsentValue(true, day)}",
            "pending" => $"__Secure-csps_vid={Vid}; __Host-csps_consent={ConsentValue(true, day)}_p",
            "unreadable-consent" => $"__Secure-csps_vid={Vid}; __Host-csps_consent=1_zz_1.0_1_1_garbage",
            _ => $"__Secure-csps_vid={Vid}; __Host-csps_consent={ConsentValue(true, day)}",
        };
        using var request = NewPost(PathBody("/gallery"));
        request.Headers.Add("Cookie", cookie);
        if (scenario == "gpc")
        {
            request.Headers.Add("Sec-GPC", "1");
        }

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await ReadRowsAsync()).ShouldHaveSingleItem().Views.ShouldBe(1);
        await using var context = database.CreateContext();
        (await context.AnalyticsVisits.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.AnalyticsPageViews.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task APageViewTwentyNineMinutesAfterTheLastReusesTheVisitAndOneThirtyOneMinutesAfterStartsANewOne()
    {
        await database.ResetAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var clock = new FakeTimeProvider(TimeProvider.System.GetUtcNow());
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = NewClient(factory);
        var cookie = await ConsentedCookieAsync(factory);

        using var first = await PostWithCookieAsync(client, PathBody("/"), cookie);
        clock.Advance(TimeSpan.FromMinutes(29));
        using var second = await PostWithCookieAsync(client, PathBody("/gallery"), cookie);
        await using (var context = database.CreateContext())
        {
            (await context.AnalyticsVisits.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem().PageViews.ShouldBe(2);
        }

        clock.Advance(TimeSpan.FromMinutes(31));
        using var third = await PostWithCookieAsync(client, PathBody("/contact"), cookie);

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        third.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var check = database.CreateContext();
        var visits = await check.AnalyticsVisits.AsNoTracking().OrderBy(visit => visit.StartedAtUtc).ToListAsync(TestContext.Current.CancellationToken);
        visits.Select(visit => visit.PageViews).ShouldBe([2, 1]);
        (await check.AnalyticsPageViews.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(3);
    }

    [Theory]
    [InlineData("m.facebook.com", DesktopChrome, "Facebook")]
    [InlineData(null, "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 [FBAN/FB4A;FBAV/450.0.0.0;]", "Facebook")]
    [InlineData(null, DesktopChrome, "Direct")]
    [InlineData("localhost", DesktopChrome, "Direct")]
    [InlineData("www.google.com", DesktopChrome, "Google")]
    [InlineData("https://evil.example/a?b=1", DesktopChrome, "Direct")]
    public async Task ANewVisitStoresTheSourceNameNeverTheRawReferrer(string? referrerHost, string userAgent, string expected)
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = NewClient(factory);
        var cookie = await ConsentedCookieAsync(factory);
        var body = referrerHost is null ? PathBody("/") : $"{{\"path\":\"/\",\"referrerHost\":\"{referrerHost}\"}}";

        using var response = await PostWithCookieAsync(client, body, cookie, userAgent);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        (await context.AnalyticsVisits.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem().Referrer.ShouldBe(expected);
    }

    [Fact]
    public async Task TwoAddressesInOneBlockShareAnAddressHashTheNextDayHasAnotherAndOnlyOneSaltIsMadePerDay()
    {
        await database.ResetAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var clock = new FakeTimeProvider(TimeProvider.System.GetUtcNow());
        await using var factory = AuthClient.WithClock(WithRemoteIp(baseFactory), clock);
        using var client = NewClient(factory);

        using var a = await PostWithAddressAsync(client, "192.0.2.10", 'a');
        using var b = await PostWithAddressAsync(client, "192.0.2.200", 'b');
        clock.Advance(TimeSpan.FromHours(24));
        using var c = await PostWithAddressAsync(client, "192.0.2.10", 'c');

        a.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        b.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        c.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        var visits = await context.AnalyticsVisits.AsNoTracking().OrderBy(visit => visit.StartedAtUtc).ToListAsync(TestContext.Current.CancellationToken);
        visits.Count.ShouldBe(3);
        visits.ShouldAllBe(visit => visit.IpHash != null);
        visits[1].IpHash.ShouldBe(visits[0].IpHash);
        visits[2].IpHash.ShouldNotBe(visits[0].IpHash);
        (await context.AnalyticsSalts.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(2);
    }

    [Fact]
    public async Task TenParallelFirstViewsFromTenVisitorsMakeOneSaltRowForTheDay()
    {
        await database.ResetAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = WithRemoteIp(baseFactory);
        using var client = NewClient(factory);
        var consent = ConsentValue(true, await BusinessDayAsync(factory));

        var responses = await Task.WhenAll(Enumerable.Range(0, 10).Select(index => Task.Run(
            async () =>
            {
                using var request = NewPost(PathBody("/"));
                request.Headers.Add("Cookie", $"__Secure-csps_vid={new string((char)('a' + index), 43)}; __Host-csps_consent={consent}");
                request.Headers.Add(RemoteIpStartupFilter.HeaderName, "192.0.2.10");
                return (await client.SendAsync(request, TestContext.Current.CancellationToken)).StatusCode;
            },
            TestContext.Current.CancellationToken)));

        responses.ShouldAllBe(status => status == HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        (await context.AnalyticsSalts.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
        (await context.AnalyticsVisits.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(10);
    }

    [Fact]
    public async Task NoStoredColumnHoldsTheRawAddressTheUserAgentTheReferrerOrTheVisitorId()
    {
        await database.ResetAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = WithRemoteIp(baseFactory);
        using var client = NewClient(factory);
        const string Marker = "zq7agent91";
        using var request = NewPost("{\"path\":\"/gallery?token=zq7query91\",\"referrerHost\":\"m.facebook.com\"}", $"{DesktopChrome} {Marker}");
        request.Headers.Add("Cookie", await ConsentedCookieAsync(factory));
        request.Headers.Add(RemoteIpStartupFilter.HeaderName, "192.0.2.10");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        var visit = (await context.AnalyticsVisits.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem();
        var salt = (await context.AnalyticsSalts.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem();
        var view = (await context.AnalyticsPageViews.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem();
        string[] forbidden = [Vid, "192.0.2", Marker, "zq7query91", "Mozilla"];
        string[] texts = [visit.Referrer, visit.Browser, visit.Os, view.PageKey, Convert.ToHexString(visit.VisitorHash), Convert.ToHexString(visit.IpHash!), Convert.ToHexString(salt.Salt)];
        foreach (var text in texts)
        {
            forbidden.ShouldAllBe(value => !text.Contains(value, StringComparison.OrdinalIgnoreCase));
        }

        visit.VisitorHash.ShouldNotBe(Encoding.UTF8.GetBytes(Vid));
        visit.IpHash.ShouldNotBe(Encoding.UTF8.GetBytes("192.0.2.0"));
        visit.IpHash.ShouldNotBe(visit.VisitorHash);
        salt.Salt.Length.ShouldBe(32);
    }

    internal static WebApplicationFactory<Program> WithRemoteIp(WebApplicationFactory<Program> factory) =>
        factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services => services.AddSingleton<IStartupFilter, RemoteIpStartupFilter>()));

    private static async Task<HttpResponseMessage> PostWithAddressAsync(HttpClient client, string address, char vidFill)
    {
        var day = DateOnly.FromDateTime(TimeProvider.System.GetUtcNow().AddHours(8).DateTime);
        using var request = NewPost(PathBody("/"));
        request.Headers.Add("Cookie", $"__Secure-csps_vid={new string(vidFill, 43)}; __Host-csps_consent={ConsentValue(true, day)}");
        request.Headers.Add(RemoteIpStartupFilter.HeaderName, address);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    internal const string Vid = "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv";

    internal static string ConsentValue(bool? stats, DateOnly day) =>
        new ConsentCookie(Guid.Parse("0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"), LegalPages.CookiePolicyVersion, stats, true, day, false).Format();

    internal static async Task<string> ConsentedCookieAsync(WebApplicationFactory<Program> factory) =>
        $"__Secure-csps_vid={Vid}; __Host-csps_consent={ConsentValue(true, await BusinessDayAsync(factory))}";

    internal static async Task<HttpResponseMessage> PostWithCookieAsync(HttpClient client, string json, string cookie, string? userAgent = DesktopChrome)
    {
        using var request = NewPost(json, userAgent);
        request.Headers.Add("Cookie", cookie);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    internal static string PathBody(string path) => $"{{\"path\":\"{path}\"}}";

    internal static HttpClient NewClient(WebApplicationFactory<Program> factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    internal static HttpRequestMessage NewPost(string json, string? userAgent = DesktopChrome, bool csrf = true)
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
