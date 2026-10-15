using System.Runtime.CompilerServices;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Authorization;

/// <summary>
/// SEC-02: every endpoint the real API maps is covered (allow-listed anonymous or a named policy, plus a matrix row),
/// and every matrix row answers each caller with its exact status, using real HS256 tokens of seeded Admin and Manager sessions.
/// </summary>
public sealed class AuthorizationMatrixTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    // The web client sends this on every call; cookie-reading auth endpoints refuse a request without it.
    private const string CsrfHeader = "X-CSPS-CSRF";

    private static readonly ConditionalWeakTable<CspsDatabase, Lazy<Task<IReadOnlyDictionary<Caller, string?>>>> SeededCallers = [];

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
        using var request = ApiRequests.Create(row.RequestMethod, row.SamplePath, await TokenForAsync(caller));
        request.Headers.Add(CsrfHeader, "1");

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
        var tokens = await TokensAsync();
        var calls = Enumerable.Range(0, 4)
            .SelectMany(_ => AuthorizationMatrix.Rows.SelectMany(row => Enum.GetValues<Caller>().Select(caller => (row, caller))))
            .ToList();

        var statuses = await Task.WhenAll(calls.Select(async call =>
        {
            using var request = ApiRequests.Create(call.row.RequestMethod, call.row.SamplePath, tokens[call.caller]);
            request.Headers.Add(CsrfHeader, "1");
            using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
            return (int)response.StatusCode;
        }));

        for (var i = 0; i < calls.Count; i++)
        {
            statuses[i].ShouldBe(calls[i].row.ExpectedFor(calls[i].caller), $"{calls[i].caller} calling {calls[i].row.Key}");
        }
    }

    // One Admin and one Manager, each with a live session, per database; the tests reuse their tokens (valid 15 minutes).
    private Task<IReadOnlyDictionary<Caller, string?>> TokensAsync() =>
        SeededCallers.GetValue(database, static db => new Lazy<Task<IReadOnlyDictionary<Caller, string?>>>(() => SeedAsync(db))).Value;

    private async Task<string?> TokenForAsync(Caller caller) => (await TokensAsync())[caller];

    private static async Task<IReadOnlyDictionary<Caller, string?>> SeedAsync(CspsDatabase db)
    {
        await using var factory = CspsApiFactory.ForDatabase(db.ConnectionString);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        return new Dictionary<Caller, string?>
        {
            [Caller.Anonymous] = null,
            [Caller.Admin] = admin.AccessToken,
            [Caller.Manager] = manager.AccessToken,
        };
    }
}
