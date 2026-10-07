using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Authorization;

/// <summary>
/// SEC-02: every endpoint the real API maps is covered (allow-listed anonymous or a named policy, plus a matrix row),
/// and every matrix row answers each caller with its exact status, using real HS256 tokens.
/// </summary>
public sealed class AuthorizationMatrixTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    /// <summary>Every matrix row for every caller.</summary>
    public static TheoryData<string, Caller> Cases
    {
        get
        {
            var cases = new TheoryData<string, Caller>();
            foreach (var row in AuthorizationMatrix.Rows)
            {
                foreach (var caller in Enum.GetValues<Caller>())
                {
                    cases.Add(row.Key, caller);
                }
            }

            return cases;
        }
    }

    [Fact]
    public async Task DiscoveredEndpointsAreFullyCovered()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var endpoints = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>().ToList();

        // Discovery must actually see the API, or an empty list would pass vacuously.
        endpoints.SelectMany(AuthorizationCoverage.KeysOf).ShouldContain("GET /api/v1/site-settings");
        AuthorizationCoverage.FindViolations(endpoints, AuthorizationMatrix.Rows, AuthorizationMatrix.AnonymousAllowList).ShouldBeEmpty();
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task MatrixRowReturnsExpectedStatus(string endpointKey, Caller caller)
    {
        var row = AuthorizationMatrix.Row(endpointKey);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = ApiRequests.Create(row.RequestMethod, row.SamplePath, TokenFor(caller));

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        ((int)response.StatusCode).ShouldBe(row.ExpectedFor(caller), $"{caller} calling {row.Key} via {row.SamplePath}");
    }

    [Fact]
    public async Task ParallelCallersEachGetTheirOwnStatus()
    {
        // SEC-02 concurrency backstop: authorization keeps no shared per-request state, so interleaved requests with
        // different tokens never see each other's result.
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var calls = Enumerable.Range(0, 4)
            .SelectMany(_ => AuthorizationMatrix.Rows.SelectMany(row => Enum.GetValues<Caller>().Select(caller => (row, caller))))
            .ToList();

        var statuses = await Task.WhenAll(calls.Select(async call =>
        {
            using var request = ApiRequests.Create(call.row.RequestMethod, call.row.SamplePath, TokenFor(call.caller));
            using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
            return (int)response.StatusCode;
        }));

        for (var i = 0; i < calls.Count; i++)
        {
            statuses[i].ShouldBe(calls[i].row.ExpectedFor(calls[i].caller), $"{calls[i].caller} calling {calls[i].row.Key}");
        }
    }

    private static string? TokenFor(Caller caller) => caller switch
    {
        Caller.Anonymous => null,
        Caller.Admin => TestTokens.For(Roles.Admin, TimeProvider.System),
        Caller.Manager => TestTokens.For(Roles.Manager, TimeProvider.System),
        _ => throw new ArgumentOutOfRangeException(nameof(caller), caller, "Unknown caller."),
    };
}
