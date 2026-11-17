using System.Net;
using System.Text;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
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

    internal static async Task<DateOnly> BusinessDayAsync(CspsApiFactory factory)
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
