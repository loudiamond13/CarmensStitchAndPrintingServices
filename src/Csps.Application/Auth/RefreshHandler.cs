using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
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
/// Use case: keep a session alive with its refresh cookie (AUTH-05, AUTH-10, D-39, D-43). Each refresh uses the
/// presented token once, issues a new access token and a new refresh token, and never moves the session's fixed end.
/// A token used a moment ago gets a sibling, so two tabs never sign each other out; a replay later revokes the session.
/// </summary>
public sealed class RefreshHandler(
    ISessions sessions,
    IUserAccounts accounts,
    IAccessTokenIssuer accessTokens,
    ISecureRandom random,
    ISessionCache sessionCache,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    AuthSettings settings,
    TimeProvider time)
{
    private const string SessionTarget = "UserSession";

    /// <summary>Refreshes a session.</summary>
    /// <param name="refreshToken">The raw token from the refresh cookie; null or empty when the cookie is missing.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new session body and cookie value, a 401 when the session cannot go on, or a 409 after two lost races.</returns>
    public async Task<Result<RefreshOutcome>> HandleAsync(string? refreshToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(refreshToken))
        {
            return Result.Failure<RefreshOutcome>(AuthErrors.SessionEnded);
        }

        var hash = TokenHash.Compute(refreshToken);
        return await ConflictRetry.RunAsync(() => AttemptAsync(hash, cancellationToken), Result.Failure<RefreshOutcome>(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
    }

    private async Task<Result<RefreshOutcome>> AttemptAsync(byte[] hash, CancellationToken cancellationToken)
    {
        var lookup = await sessions.FindByRefreshHashAsync(hash, cancellationToken).ConfigureAwait(false);
        var now = time.GetUtcNow();
        if (lookup is null || !lookup.Session.IsActive(now))
        {
            return Result.Failure<RefreshOutcome>(AuthErrors.SessionEnded);
        }

        var session = lookup.Session;
        var user = await accounts.FindByIdAsync(session.UserId, cancellationToken).ConfigureAwait(false);
        if (user is null || !user.IsActive || user.LockoutEnd > now)
        {
            await EndForInactiveAccountAsync(lookup, now, cancellationToken).ConfigureAwait(false);
            return Result.Failure<RefreshOutcome>(AuthErrors.SessionEnded);
        }

        var next = random.NewToken();
        var rotation = session.Rotate(lookup.Presented, lookup.Related, TokenHash.Compute(next), now, settings.ToSessionSettings());
        switch (rotation.Outcome)
        {
            case RotationOutcome.Rotated or RotationOutcome.GraceSibling:
                sessions.AddToken(rotation.NewToken!);
                var access = accessTokens.Issue(user.Id, user.Role, session.Id);
                await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                var response = new SessionResponse(
                    access.Token,
                    access.ExpiresAt,
                    session.AbsoluteExpiresAt,
                    session.Persistent,
                    new SessionUser(user.Id, user.Email, user.FirstName, user.LastName, user.Role));
                return Result.Success(new RefreshOutcome(response, next, session.CookieExpiresAt));

            case RotationOutcome.ReuseDetected:
                // The revocation is committed first; the alarm is written on its own path so it survives any later failure (T-04-50).
                await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                await sessionCache.EvictAsync(session.Id, cancellationToken).ConfigureAwait(false);
                await audit.RecordIndependentlyAsync(AuditActions.RefreshReuseDetected, SessionTarget, Key(session.Id), null, cancellationToken)
                    .ConfigureAwait(false);
                return Result.Failure<RefreshOutcome>(AuthErrors.SessionEnded);

            default:
                return Result.Failure<RefreshOutcome>(AuthErrors.SessionEnded);
        }
    }

    // A deactivated, locked or removed account keeps no session (AUTH-10, T-04-53): revoke it now and make its access token fail at once.
    private async Task EndForInactiveAccountAsync(RefreshLookup lookup, DateTimeOffset now, CancellationToken cancellationToken)
    {
        lookup.Session.Revoke(SessionRevocationReason.AccountInactive, now, lookup.Related);
        audit.Record(AuditActions.SessionRevoked, SessionTarget, Key(lookup.Session.Id), null);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await sessionCache.EvictAsync(lookup.Session.Id, cancellationToken).ConfigureAwait(false);
    }

    private static string Key(Guid id) => id.ToString("D", CultureInfo.InvariantCulture);
}
