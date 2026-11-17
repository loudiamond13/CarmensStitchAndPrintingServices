using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Domain.Content;
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
        using var client = NewClient(factory);
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

        var cookie = SetCookieOf(response, AnalyticsCookies.ConsentCookieName).ShouldNotBeNull();
        var attributes = cookie.ToLowerInvariant();
        attributes.ShouldContain("; path=/");
        attributes.ShouldNotContain("; path=/api");
        attributes.ShouldContain("; secure");
        attributes.ShouldContain("; samesite=lax");
        attributes.ShouldNotContain("httponly");
        ExpiresOf(cookie).ShouldBe(record.DecidedAtUtc.AddMonths(12), TimeSpan.FromSeconds(2));

        ConsentCookie.TryParse(ValueOf(cookie), out var parsed).ShouldBeTrue();
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
        using var client = NewClient(factory);

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
        using var client = NewClient(factory);

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
        using var client = NewClient(factory);

        using var response = await PostAsync(client, AcceptAll(), csrf: false);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ReadRecordsAsync()).ShouldBeEmpty();
        SetCookieOf(response, AnalyticsCookies.ConsentCookieName).ShouldBeNull();
    }

    [Fact]
    public async Task ARecordHoldsNoAddressAndNoBrowserName()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = NewClient(factory);
        using var request = NewPost(AcceptAll());
        request.Headers.UserAgent.ParseAdd("Mozilla/5.0 (test-agent-marker)");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        var columns = context.Model.FindEntityType(typeof(ConsentRecord))!.GetProperties().Select(property => property.Name).ToList();
        columns.ShouldBe(["Id", "ConsentId", "PolicyVersion", "Stats", "Map", "Gpc", "Source", "DecidedAtUtc"], ignoreOrder: true);
    }

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

    internal static HttpClient NewClient(WebApplicationFactory<Program> factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    internal static HttpRequestMessage NewPost(string json, bool csrf = true)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, new Uri(Route, UriKind.Relative))
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
        };
        if (csrf)
        {
            request.Headers.Add(RequireCsrfHeaderAttribute.HeaderName, "1");
        }

        return request;
    }

    internal static async Task<HttpResponseMessage> PostAsync(HttpClient client, string json, bool csrf = true)
    {
        using var request = NewPost(json, csrf);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    internal static string? SetCookieOf(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues("Set-Cookie", out var values)
            ? values.FirstOrDefault(value => value.StartsWith(name + "=", StringComparison.Ordinal))
            : null;

    internal static string ValueOf(string setCookie) => setCookie.Split(';')[0][(setCookie.IndexOf('=', StringComparison.Ordinal) + 1)..];

    internal static DateTimeOffset ExpiresOf(string setCookie)
    {
        var expires = setCookie.Split(';').Select(part => part.Trim()).Single(part => part.StartsWith("expires=", StringComparison.OrdinalIgnoreCase));
        return DateTimeOffset.Parse(expires["expires=".Length..], CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal);
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
