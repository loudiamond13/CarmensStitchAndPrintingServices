using System.Net;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>
/// AUTH-05, AUTH-06, IN-04, T-04-42 to T-04-44: an access token names a stored session, and ending that session ends
/// access on the very next request. Runs on the real session cache against a real database.
/// </summary>
public sealed class SessionRevocationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/site-settings";

    [Fact]
    public async Task ASessionTokenReadsSettingsAndIsRefusedTheMomentTheSessionIsRevoked()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var started = await TestSessions.StartAsync(factory);

        (await GetAsync(client, started.AccessToken)).ShouldBe(HttpStatusCode.OK);

        await RevokeAsync(factory, started.SessionId);

        (await GetAsync(client, started.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ARevokedSessionStaysRefusedOnRepeatedRequests()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var started = await TestSessions.StartAsync(factory, Roles.Admin);
        await RevokeAsync(factory, started.SessionId);

        (await GetAsync(client, started.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);
        (await GetAsync(client, started.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ATokenForAnUnknownSessionIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var token = TestTokens.For(Roles.Manager, TimeProvider.System, sessionId: Guid.NewGuid());

        (await GetAsync(client, token)).ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ATokenWhoseSessionBelongsToAnotherUserIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var started = await TestSessions.StartAsync(factory);
        var token = TestTokens.For(Roles.Manager, TimeProvider.System, userId: Guid.NewGuid(), sessionId: started.SessionId);

        (await GetAsync(client, token)).ShouldBe(HttpStatusCode.Unauthorized);
        (await GetAsync(client, started.AccessToken)).ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ASignedTokenOfAnotherTypeIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var started = await TestSessions.StartAsync(factory);
        var token = TestTokens.WithType(Roles.Manager, "JWT", userId: started.UserId, sessionId: started.SessionId);

        (await GetAsync(client, token)).ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ATokenWithoutASessionClaimIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var started = await TestSessions.StartAsync(factory);
        var token = TestTokens.WithoutSession(Roles.Manager, userId: started.UserId);

        (await GetAsync(client, token)).ShouldBe(HttpStatusCode.Unauthorized);
    }

    private static async Task<HttpStatusCode> GetAsync(HttpClient client, string token)
    {
        using var request = ApiRequests.Get(Route, token);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        return response.StatusCode;
    }

    private static async Task RevokeAsync(CspsApiFactory factory, Guid sessionId)
    {
        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var sessions = scope.ServiceProvider.GetRequiredService<ISessions>();
            var session = (await sessions.FindAsync(sessionId, TestContext.Current.CancellationToken)).ShouldNotBeNull();
            session.Revoke(SessionRevocationReason.SignedOut, TimeProvider.System.GetUtcNow());
            await scope.ServiceProvider.GetRequiredService<IUnitOfWork>().SaveChangesAsync(TestContext.Current.CancellationToken);
            await scope.ServiceProvider.GetRequiredService<ISessionCache>().EvictAsync(sessionId, TestContext.Current.CancellationToken);
        }
    }
}
