using System.Net;
using System.Net.Http.Json;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>AUTH-05, T-04-47: endpoints that read an auth cookie need the X-CSPS-CSRF header and a same-origin fetch.</summary>
public sealed class CsrfHeaderTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AMissingHeaderIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        using var request = Post(AuthClient.VerifyRoute, header: null, fetchSite: null);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        await ShouldBeCsrfRefusalAsync(response);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("true")]
    [InlineData("11")]
    public async Task AWrongHeaderValueIsRefused(string value)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        using var request = Post(AuthClient.VerifyRoute, header: value, fetchSite: null);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        await ShouldBeCsrfRefusalAsync(response);
    }

    [Theory]
    [InlineData("cross-site")]
    [InlineData("same-site")]
    [InlineData("none")]
    public async Task ARequestThatIsNotSameOriginIsRefused(string fetchSite)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        using var request = Post(AuthClient.VerifyRoute, header: "1", fetchSite);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        await ShouldBeCsrfRefusalAsync(response);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("same-origin")]
    public async Task TheHeaderWithASameOriginFetchIsHandledNormally(string? fetchSite)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        using var request = Post(AuthClient.VerifyRoute, header: "1", fetchSite);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        // No ticket cookie: the normal answer, not a CSRF refusal.
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("auth.ticket-expired");
    }

    private static HttpRequestMessage Post(string route, string? header, string? fetchSite)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, new Uri(route, UriKind.Relative))
        {
            Content = JsonContent.Create(new { code = "123456" }),
        };
        if (header is not null)
        {
            request.Headers.Add(AuthClient.CsrfHeader, header);
        }

        if (fetchSite is not null)
        {
            request.Headers.Add("Sec-Fetch-Site", fetchSite);
        }

        return request;
    }

    private static async Task ShouldBeCsrfRefusalAsync(HttpResponseMessage response)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("auth.csrf-check-failed");
    }
}
