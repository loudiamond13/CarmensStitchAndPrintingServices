using Csps.Application.Ports;
using Csps.Domain.Identity;

namespace Csps.Application.Auth;

/// <summary>A started session: the response for the client plus what the controller sets in the refresh cookie.</summary>
/// <param name="Response">The body for the client.</param>
/// <param name="RefreshToken">The raw first refresh token for the cookie. A secret.</param>
/// <param name="CookieExpiresAt">When the cookie expires; null for a browser-session cookie.</param>
/// <param name="SessionId">The new session's id, for the audit entry.</param>
public sealed record IssuedSession(SessionResponse Response, string RefreshToken, DateTimeOffset? CookieExpiresAt, Guid SessionId)
{
    /// <summary>Returns the type name only, so the token never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(IssuedSession);
}

/// <summary>
/// Starts a session for a signed-in user: the session row, its first refresh token (only the hash is stored) and an
/// access token that names the session (AUTH-05, D-43). The caller saves the unit of work.
/// </summary>
public sealed class SessionIssuer(
    ISessions sessions,
    IAccessTokenIssuer accessTokens,
    ISecureRandom random,
    IRequestContext requestContext,
    AuthSettings settings,
    TimeProvider time)
{
    /// <summary>Starts a session.</summary>
    /// <param name="user">The account that just completed sign-in.</param>
    /// <param name="persistent">True when "Keep me signed in" was chosen.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The response, the raw refresh token and the cookie expiry.</returns>
    public Task<IssuedSession> StartAsync(UserAccount user, bool persistent, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(user);
        cancellationToken.ThrowIfCancellationRequested();

        var now = time.GetUtcNow();
        var refreshToken = random.NewToken();
        var label = DeviceSummary.Describe(requestContext.UserAgent).Label;
        var (session, firstToken) = UserSession.Start(
            user.Id, persistent, label, TokenHash.Compute(refreshToken), now, settings.ToSessionSettings());
        sessions.Add(session, firstToken);

        var access = accessTokens.Issue(user.Id, user.Role, session.Id);
        var response = new SessionResponse(
            access.Token,
            access.ExpiresAt,
            session.AbsoluteExpiresAt,
            persistent,
            new SessionUser(user.Id, user.Email, user.FirstName, user.LastName, user.Role));
        return Task.FromResult(new IssuedSession(response, refreshToken, session.CookieExpiresAt, session.Id));
    }
}
