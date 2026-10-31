using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Auth;

/// <summary>
/// Use case: sign out every other device (AUTH-06, D-05, D-44). The caller's user and session come only from the
/// access token, so only the caller's own other sessions end, and this device stays signed in. Having nothing to
/// revoke is still a success.
/// </summary>
public sealed class SignOutOthersHandler(
    ISessions sessions,
    ISessionCache sessionCache,
    IRequestContext requestContext,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time)
{
    /// <summary>Signs out the caller's other sessions.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 401 when the token names no user or session, or a 409 when two saves in a row lost a race.</returns>
    public async Task<Result> HandleAsync(CancellationToken cancellationToken)
    {
        // Without both ids the keep-this-device rule cannot hold, so nothing is revoked (D-05).
        if (requestContext.UserId is not { } userId || requestContext.SessionId is not { } sessionId)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        return await ConflictRetry.RunAsync(() => AttemptAsync(userId, sessionId, cancellationToken), Result.Failure(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
    }

    private async Task<Result> AttemptAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken)
    {
        var revoked = await sessions.RevokeAllAsync(userId, sessionId, SessionRevocationReason.SignedOutOtherDevices, time.GetUtcNow(), cancellationToken)
            .ConfigureAwait(false);
        if (revoked.Count == 0)
        {
            return Result.Success();
        }

        audit.Record(AuditActions.SessionsRevoked, "User", userId.ToString("D", CultureInfo.InvariantCulture), AuditActions.DetailSignOutOthers);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        foreach (var id in revoked)
        {
            await sessionCache.EvictAsync(id, cancellationToken).ConfigureAwait(false);
        }

        return Result.Success();
    }
}
