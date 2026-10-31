using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Security;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Csps.Testing;

/// <summary>A staff account with a live session and the access token that names it.</summary>
/// <param name="UserId">The account id.</param>
/// <param name="SessionId">The session id (the token's <c>sid</c>).</param>
/// <param name="AccessToken">The access token issued by the real issuer.</param>
public sealed record StartedSession(Guid UserId, Guid SessionId, string AccessToken);

/// <summary>Creates staff accounts with live sessions through the real services, for tests that need a database-backed token.</summary>
public static class TestSessions
{
    /// <summary>Creates a staff account and starts a session for it.</summary>
    /// <param name="factory">A host with a database; a host with a fixed clock issues tokens for that clock.</param>
    /// <param name="role">The role, <c>Admin</c> or <c>Manager</c>.</param>
    /// <returns>The account, its session and the access token.</returns>
    public static async Task<StartedSession> StartAsync(WebApplicationFactory<Program> factory, string role = Roles.Manager)
    {
        ArgumentNullException.ThrowIfNull(factory);
        var scope = factory.Services.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
            var services = scope.ServiceProvider;
            var accounts = services.GetRequiredService<IUserAccounts>();
            var id = await accounts.CreateAsync(
                new NewUserAccount($"session.{Guid.NewGuid():N}@example.com", "Paolo", "Reyes", role, $"Pw-{Guid.NewGuid():N}!x"),
                CancellationToken.None).ConfigureAwait(false);
            var user = await accounts.FindByIdAsync(id, CancellationToken.None).ConfigureAwait(false)
                ?? throw new InvalidOperationException("The account just created was not found.");

            var issued = await services.GetRequiredService<SessionIssuer>().StartAsync(user, persistent: false, CancellationToken.None).ConfigureAwait(false);
            await services.GetRequiredService<IUnitOfWork>().SaveChangesAsync(CancellationToken.None).ConfigureAwait(false);

            var token = issued.Response.AccessToken;
            return new StartedSession(id, Guid.Parse(new JsonWebToken(token).GetClaim("sid").Value), token);
        }
    }
}
