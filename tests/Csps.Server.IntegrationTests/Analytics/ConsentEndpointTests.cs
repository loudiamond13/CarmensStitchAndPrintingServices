using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Domain.Content;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.Security;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Analytics;

/// <summary>
/// ANL-01, ANL-02, ANL-05, ANL-07, D-18, D-20, D-22, D-41: <c>POST /api/v1/analytics/consent</c> logs every decision with the server's time,
/// saves the choice cookie from the server, and answers with the state it stored.
/// </summary>
public sealed class ConsentEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/analytics/consent";
    private const string ConsentChain = "0a1b2c3d4e5f4a6b8c7d9e0f1a2b3c4d";

    [Fact]
    public async Task AcceptAllFromAFreshClientLogsOneRecordAndSavesTheChoiceCookie()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);
        var before = TimeProvider.System.GetUtcNow();

        using var response = await PostAsync(client, AcceptAll());

        var after = TimeProvider.System.GetUtcNow();
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var record = (await ReadRecordsAsync()).ShouldHaveSingleItem();
        record.Stats.ShouldBe(true);
        record.Map.ShouldBeTrue();
        record.Gpc.ShouldBeFalse();
        record.Source.ShouldBe(ConsentSource.Bar);
        record.PolicyVersion.ShouldBe(LegalPages.CookiePolicyVersion);
        record.ConsentId.ShouldNotBe(Guid.Empty);
        record.DecidedAtUtc.ShouldBeInRange(before.AddSeconds(-1), after.AddSeconds(1));

        var cookie = AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.ConsentCookieName).ShouldNotBeNull();
        var attributes = cookie.ToLowerInvariant();
        attributes.ShouldContain("; path=/");
        attributes.ShouldNotContain("; path=/api");
        attributes.ShouldContain("; secure");
        attributes.ShouldContain("; samesite=lax");
        attributes.ShouldNotContain("httponly");
        AnalyticsHttp.ExpiresOf(cookie).ShouldBe(record.DecidedAtUtc.AddMonths(12), TimeSpan.FromSeconds(2));

        ConsentCookie.TryParse(AnalyticsHttp.ValueOf(cookie), out var parsed).ShouldBeTrue();
        parsed.ShouldNotBeNull();
        parsed.Pending.ShouldBeFalse();
        parsed.ConsentId.ShouldBe(record.ConsentId);
        parsed.PolicyVersion.ShouldBe(LegalPages.CookiePolicyVersion);
        parsed.Stats.ShouldBe(true);
        parsed.Map.ShouldBeTrue();
        parsed.DecidedOn.ShouldBe(await BusinessDayOfAsync(factory, record.DecidedAtUtc));
    }

    [Fact]
    public async Task TheAnswerIsTheStateTheServerStored()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostAsync(client, AcceptAll());

        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("application/json");
        var record = (await ReadRecordsAsync()).ShouldHaveSingleItem();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var root = document.RootElement;
        root.EnumerateObject().Select(property => property.Name).ShouldBe(["consentId", "policyVersion", "stats", "map", "gpc", "decidedOn"]);
        root.GetProperty("consentId").GetString().ShouldBe(record.ConsentId.ToString("N"));
        root.GetProperty("policyVersion").GetString().ShouldBe(LegalPages.CookiePolicyVersion);
        root.GetProperty("stats").GetBoolean().ShouldBeTrue();
        root.GetProperty("map").GetBoolean().ShouldBeTrue();
        root.GetProperty("gpc").GetBoolean().ShouldBeFalse();
        root.GetProperty("decidedOn").GetString().ShouldBe((await BusinessDayOfAsync(factory, record.DecidedAtUtc)).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
    }

    [Fact]
    public async Task AFirstDecisionWithNoChainIdGetsANewOneAndALaterDecisionKeepsTheOneItSends()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var first = await PostAsync(client, AcceptAll());
        using var second = await PostAsync(client, Body(consentId: ConsentChain, stats: false, map: false, source: "settings"));

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        var records = await ReadRecordsAsync();
        records.Count.ShouldBe(2);
        var generated = records.Single(record => record.Source == ConsentSource.Bar);
        generated.ConsentId.ShouldNotBe(Guid.Empty);
        generated.ConsentId.ToString("N").ShouldNotBe(ConsentChain);
        records.Single(record => record.Source == ConsentSource.Settings).ConsentId.ToString("N").ShouldBe(ConsentChain);
    }

    [Fact]
    public async Task ACallWithoutTheAntiCsrfHeaderIs403AndRecordsNothing()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostAsync(client, AcceptAll(), csrf: false);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ReadRecordsAsync()).ShouldBeEmpty();
        AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.ConsentCookieName).ShouldBeNull();
    }

    [Fact]
    public async Task ARecordHoldsNoAddressAndNoBrowserName()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);
        using var request = AnalyticsHttp.NewPost(Route, AcceptAll());
        request.Headers.UserAgent.ParseAdd("Mozilla/5.0 (test-agent-marker)");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        var columns = context.Model.FindEntityType(typeof(ConsentRecord))!.GetProperties().Select(property => property.Name).ToList();
        columns.ShouldBe(["Id", "ConsentId", "PolicyVersion", "Stats", "Map", "Gpc", "Source", "DecidedAtUtc"], ignoreOrder: true);
    }

    [Fact]
    public async Task AnOldPolicyVersionIs409WithTheCodeAndTheCurrentVersionAndRecordsNothing()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostAsync(client, Body(policyVersion: "0.0", stats: true, map: true, source: "bar"));

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("consent.policy-changed");
        problem.GetProperty("currentVersion").GetString().ShouldBe(LegalPages.CookiePolicyVersion);
        (await ReadRecordsAsync()).ShouldBeEmpty();
        AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.ConsentCookieName).ShouldBeNull();
    }

    [Theory]
    [InlineData("{\"policyVersion\":\"1\",\"stats\":true,\"map\":true,\"source\":\"bar\"}", "policyVersion")]
    [InlineData("{\"stats\":true,\"map\":true,\"source\":\"bar\"}", "policyVersion")]
    [InlineData("{\"policyVersion\":\"0.1\",\"stats\":true,\"map\":true,\"source\":\"clear\"}", "source")]
    [InlineData("{\"policyVersion\":\"0.1\",\"stats\":true,\"map\":true}", "source")]
    [InlineData("{\"consentId\":\"ZZ\",\"policyVersion\":\"0.1\",\"stats\":true,\"map\":true,\"source\":\"bar\"}", "consentId")]
    [InlineData("{}", "policyVersion")]
    [InlineData("not json", "policyVersion")]
    [InlineData("", "policyVersion")]
    public async Task ABadBodyIs400NamingTheFieldAndRecordsNothing(string json, string field)
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostAsync(client, json);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").TryGetProperty(field, out _).ShouldBeTrue($"the 400 must name {field}");
        (await ReadRecordsAsync()).ShouldBeEmpty();
        AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.ConsentCookieName).ShouldBeNull();
    }

    [Fact]
    public async Task UnderGpcStatsIsStoredOffWhateverTheBodySaysAndTheGpcFlagIsStored()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);
        using var request = AnalyticsHttp.NewPost(Route, AcceptAll());
        request.Headers.Add("Sec-GPC", "1");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var record = (await ReadRecordsAsync()).ShouldHaveSingleItem();
        record.Stats.ShouldBe(false);
        record.Gpc.ShouldBeTrue();
        record.Map.ShouldBeTrue();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.GetProperty("stats").GetBoolean().ShouldBeFalse();
        document.RootElement.GetProperty("gpc").GetBoolean().ShouldBeTrue();
        ConsentCookie.TryParse(AnalyticsHttp.ValueOf(AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.ConsentCookieName)!), out var cookie).ShouldBeTrue();
        cookie!.Stats.ShouldBe(false);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("true")]
    [InlineData("")]
    public async Task OnlyTheValueOneCountsAsGpc(string header)
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);
        using var request = AnalyticsHttp.NewPost(Route, AcceptAll());
        request.Headers.TryAddWithoutValidation("Sec-GPC", header);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var record = (await ReadRecordsAsync()).ShouldHaveSingleItem();
        record.Gpc.ShouldBeFalse();
        record.Stats.ShouldBe(true);
    }

    [Fact]
    public async Task GpcAloneCreatesNoRecordOnAnyOtherRequest()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri("/health", UriKind.Relative));
        request.Headers.Add("Sec-GPC", "1");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldNotBe(HttpStatusCode.NotFound);
        (await ReadRecordsAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task AMapOnlySaveStoresNullStatsAndTheCookieShowsADash()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostAsync(client, Body(stats: null, map: true, source: "map-link"));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var record = (await ReadRecordsAsync()).ShouldHaveSingleItem();
        record.Stats.ShouldBeNull();
        record.Map.ShouldBeTrue();
        record.Source.ShouldBe(ConsentSource.MapLink);
        var value = AnalyticsHttp.ValueOf(AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.ConsentCookieName)!);
        value.ShouldContain($"_{LegalPages.CookiePolicyVersion}_-_1_");
        ConsentCookie.TryParse(value, out var cookie).ShouldBeTrue();
        cookie!.Stats.ShouldBeNull();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.GetProperty("stats").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task TwoIdenticalPostsAddTwoRecordsWithTheSameChain()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);
        var body = Body(consentId: ConsentChain, stats: true, map: true, source: "settings");

        using var first = await PostAsync(client, body);
        using var second = await PostAsync(client, body);

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        var records = await ReadRecordsAsync();
        records.Count.ShouldBe(2);
        records.Select(record => record.ConsentId.ToString("N")).Distinct().ShouldBe([ConsentChain]);
        records[1].Id.ShouldNotBe(records[0].Id);
    }

    [Fact]
    public async Task StatsOnIssuesAPrivateVisitorIdThatOnlyTheAnalyticsApiSees()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostAsync(client, AcceptAll());

        var record = (await ReadRecordsAsync()).ShouldHaveSingleItem();
        var cookie = AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.VisitorCookieName).ShouldNotBeNull();
        var token = AnalyticsHttp.ValueOf(cookie);
        token.Length.ShouldBe(43);
        token.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_').ShouldBeTrue("the id is base64url");
        var attributes = cookie.ToLowerInvariant();
        attributes.ShouldContain("; path=/api/v1/analytics");
        attributes.ShouldContain("; secure");
        attributes.ShouldContain("; samesite=strict");
        attributes.ShouldContain("; httponly");
        AnalyticsHttp.ExpiresOf(cookie).ShouldBe(record.DecidedAtUtc.AddMonths(12), TimeSpan.FromSeconds(2));
    }

    [Fact]
    public async Task TwoFirstDecisionsGetDifferentVisitorIds()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var first = await PostAsync(client, AcceptAll());
        using var second = await PostAsync(client, AcceptAll());

        AnalyticsHttp.ValueOf(AnalyticsHttp.SetCookieOf(first, AnalyticsCookies.VisitorCookieName)!).ShouldNotBe(AnalyticsHttp.ValueOf(AnalyticsHttp.SetCookieOf(second, AnalyticsCookies.VisitorCookieName)!));
    }

    [Fact]
    public async Task AVisitorIdAlreadyHeldIsKeptAndNotReplaced()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostWithVisitorAsync(client, AcceptAll(), ExistingVisitor);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.VisitorCookieName).ShouldBeNull();
    }

    [Theory]
    [InlineData("short")]
    [InlineData("has space and not base64url chars!!!!!!!!!!!!!!!!")]
    public async Task AMalformedVisitorIdIsReplacedByANewOne(string held)
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostWithVisitorAsync(client, AcceptAll(), held);

        var cookie = AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.VisitorCookieName).ShouldNotBeNull();
        AnalyticsHttp.ValueOf(cookie).Length.ShouldBe(43);
    }

    [Fact]
    public async Task StatsOffExpiresAHeldVisitorIdWithTheSamePathAndAttributes()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostWithVisitorAsync(client, Body(stats: false, map: false, source: "settings"), ExistingVisitor);

        AssertExpired(AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.VisitorCookieName));
    }

    [Fact]
    public async Task AMapOnlySaveWithNullStatsExpiresAHeldVisitorId()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostWithVisitorAsync(client, Body(stats: null, map: true, source: "map-link"), ExistingVisitor);

        AssertExpired(AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.VisitorCookieName));
    }

    [Fact]
    public async Task StatsOffWithNoVisitorIdHeldSetsNoVisitorCookie()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var response = await PostAsync(client, Body(stats: false, map: false, source: "bar"));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        AnalyticsHttp.SetCookieOf(response, AnalyticsCookies.VisitorCookieName).ShouldBeNull();
    }

    [Fact]
    public async Task UnderGpcNoVisitorIdIsIssuedAndAHeldOneIsExpired()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);

        using var fresh = await PostWithVisitorAsync(client, AcceptAll(), held: null, gpc: true);
        using var held = await PostWithVisitorAsync(client, AcceptAll(), ExistingVisitor, gpc: true);

        AnalyticsHttp.SetCookieOf(fresh, AnalyticsCookies.VisitorCookieName).ShouldBeNull();
        AssertExpired(AnalyticsHttp.SetCookieOf(held, AnalyticsCookies.VisitorCookieName));
    }

    private static void AssertExpired(string? cookie)
    {
        cookie.ShouldNotBeNull();
        AnalyticsHttp.ValueOf(cookie).ShouldBeEmpty();
        var attributes = cookie.ToLowerInvariant();
        attributes.ShouldContain("; path=/api/v1/analytics");
        attributes.ShouldContain("; secure");
        attributes.ShouldContain("; samesite=strict");
        attributes.ShouldContain("; httponly");
        AnalyticsHttp.ExpiresOf(cookie).ShouldBeLessThan(TimeProvider.System.GetUtcNow());
    }

    private static async Task<HttpResponseMessage> PostWithVisitorAsync(HttpClient client, string json, string? held, bool gpc = false)
    {
        using var request = AnalyticsHttp.NewPost(Route, json);
        if (held is not null)
        {
            request.Headers.TryAddWithoutValidation("Cookie", $"{AnalyticsCookies.VisitorCookieName}={held}");
        }

        if (gpc)
        {
            request.Headers.Add("Sec-GPC", "1");
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static readonly string ExistingVisitor = new('q', 43);

    internal static string AcceptAll() => Body(stats: true, map: true, source: "bar");

    internal static string Body(string? consentId = null, string? policyVersion = null, bool? stats = null, bool map = false, string? source = null)
    {
        var fields = new List<string>();
        if (consentId is not null)
        {
            fields.Add($"\"consentId\":\"{consentId}\"");
        }

        fields.Add($"\"policyVersion\":\"{policyVersion ?? LegalPages.CookiePolicyVersion}\"");
        fields.Add($"\"stats\":{(stats is null ? "null" : stats.Value ? "true" : "false")}");
        fields.Add($"\"map\":{(map ? "true" : "false")}");
        if (source is not null)
        {
            fields.Add($"\"source\":\"{source}\"");
        }

        return "{" + string.Join(',', fields) + "}";
    }

    internal static async Task<HttpResponseMessage> PostAsync(HttpClient client, string json, bool csrf = true)
    {
        using var request = AnalyticsHttp.NewPost(Route, json, csrf);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    internal static async Task<DateOnly> BusinessDayOfAsync(CspsApiFactory factory, DateTimeOffset instant)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var clock = await scope.ServiceProvider.GetRequiredService<IBusinessCalendar>().GetClockAsync(TestContext.Current.CancellationToken);
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(instant, clock.Zone).DateTime);
    }

    private async Task<List<ConsentRecord>> ReadRecordsAsync()
    {
        await using var context = database.CreateContext();
        return await context.ConsentRecords.AsNoTracking().OrderBy(record => record.DecidedAtUtc).ToListAsync(TestContext.Current.CancellationToken);
    }
}
