using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Auth;

/// <summary>The answer to a per-device sign-out.</summary>
/// <param name="AlreadySignedOut">True when the session had already ended, so nothing was changed.</param>
public sealed record RevokeSessionResponse(bool AlreadySignedOut);

/// <summary>
/// Use case: sign out one of the caller's other devices (D-43). Only the caller's own sessions can be reached: another
/// user's and an unknown id get the same answer (CWE-639). The current session is refused, because Logout ends it.
/// A session that already ended is a success, so repeating the call is safe.
/// </summary>
public sealed class RevokeSessionHandler(
    ISessions sessions,
    ISessionCache sessionCache,
    IRequestContext requestContext,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time)
{
    /// <summary>Signs out one session of the caller.</summary>
    /// <param name="sessionId">The session to sign out.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// Success with whether it had already ended, a 404 for a session that is not the caller's, a 422 for the current
    /// session, a 401 when the token names no user or session, or a 409 when two saves in a row lost a race.
    /// </returns>
    public async Task<Result<RevokeSessionResponse>> HandleAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is not { } userId || requestContext.SessionId is not { } currentId)
        {
            return Result.Failure<RevokeSessionResponse>(AuthErrors.SessionEnded);
        }

        return await ConflictRetry.RunAsync(
            () => AttemptAsync(sessionId, userId, currentId, cancellationToken),
            Result.Failure<RevokeSessionResponse>(AuthErrors.SessionBusy)).ConfigureAwait(false);
    }

    private async Task<Result<RevokeSessionResponse>> AttemptAsync(Guid sessionId, Guid userId, Guid currentId, CancellationToken cancellationToken)
    {
        var session = await sessions.FindAsync(sessionId, cancellationToken).ConfigureAwait(false);
        if (session is null || session.UserId != userId)
        {
            return Result.Failure<RevokeSessionResponse>(AuthErrors.SessionNotFound);
        }

        if (session.Id == currentId)
        {
            return Result.Failure<RevokeSessionResponse>(AuthErrors.SessionCurrent);
        }

        var now = time.GetUtcNow();
        if (!session.IsActive(now))
        {
            return Result.Success(new RevokeSessionResponse(AlreadySignedOut: true));
        }

        session.Revoke(SessionRevocationReason.DeviceSignedOut, now);
        audit.Record(AuditActions.SessionRevoked, "UserSession", session.Id.ToString("D", CultureInfo.InvariantCulture), null);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await sessionCache.EvictAsync(session.Id, cancellationToken).ConfigureAwait(false);
        return Result.Success(new RevokeSessionResponse(AlreadySignedOut: false));
    }
}
