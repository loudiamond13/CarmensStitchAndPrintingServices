using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Auth;

/// <summary>What a refresh hands back to the controller: the session for the client and the rotated cookie value.</summary>
/// <param name="Response">The body for the client.</param>
/// <param name="RefreshToken">The raw new refresh token for the cookie. A secret.</param>
/// <param name="CookieExpiresAt">When the cookie expires; null for a browser-session cookie.</param>
public sealed record RefreshOutcome(SessionResponse Response, string RefreshToken, DateTimeOffset? CookieExpiresAt)
{
    /// <summary>Returns the type name only, so the token never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(RefreshOutcome);
}

/// <summary>
/// Use case: keep a session alive with its refresh cookie (AUTH-05, D-43). Each refresh uses the presented token once,
/// issues a new access token and a new refresh token, and never moves the session's fixed end.
/// </summary>
public sealed class RefreshHandler(
    ISessions sessions,
    IUserAccounts accounts,
    IAccessTokenIssuer accessTokens,
    ISecureRandom random,
    IUnitOfWork unitOfWork,
    AuthSettings settings,
    TimeProvider time)
{
    /// <summary>Refreshes a session.</summary>
    /// <param name="refreshToken">The raw token from the refresh cookie; null or empty when the cookie is missing.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new session body and cookie value, or a 401 when the session cannot go on.</returns>
    public async Task<Result<RefreshOutcome>> HandleAsync(string? refreshToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(refreshToken))
        {
            return Result.Failure<RefreshOutcome>(AuthErrors.SessionEnded);
        }

        var lookup = await sessions.FindByRefreshHashAsync(TokenHash.Compute(refreshToken), cancellationToken).ConfigureAwait(false);
        if (lookup is null)
        {
            return Result.Failure<RefreshOutcome>(AuthErrors.SessionEnded);
        }

        var session = lookup.Session;
        var user = await accounts.FindByIdAsync(session.UserId, cancellationToken).ConfigureAwait(false);
        if (user is null)
        {
            return Result.Failure<RefreshOutcome>(AuthErrors.SessionEnded);
        }

        var next = random.NewToken();
        var rotation = session.Rotate(lookup.Presented, lookup.Related, TokenHash.Compute(next), time.GetUtcNow(), settings.ToSessionSettings());
        if (rotation.NewToken is null)
        {
            return Result.Failure<RefreshOutcome>(AuthErrors.SessionEnded);
        }

        sessions.AddToken(rotation.NewToken);
        var access = accessTokens.Issue(user.Id, user.Role, session.Id);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        var response = new SessionResponse(
            access.Token,
            access.ExpiresAt,
            session.AbsoluteExpiresAt,
            session.Persistent,
            new SessionUser(user.Id, user.Email, user.FirstName, user.LastName, user.Role));
        return Result.Success(new RefreshOutcome(response, next, session.CookieExpiresAt));
    }
}
