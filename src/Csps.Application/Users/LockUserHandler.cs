using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Users;

/// <summary>
/// Use case: a Manager locks a staff account (USER-03, USER-04, USER-05, D-16, D-17, D-18, D-19, D-21). The lock has no timer and only a
/// Manager lifts it. In one transaction the lock is set, every session of that person ends, and the audit trail records
/// <c>user.locked</c> and the revocation. The person is then forgotten by the session cache, so their next request with an old token is
/// a 401. An account that is already locked is a success that changes and records nothing. No version is sent: the change applies to
/// the latest state. A locked Manager no longer counts as active, so the roster lock is taken first, before the target is read or
/// Managers are counted, and two Managers locking each other at once cannot both succeed.
/// </summary>
public sealed class LockUserHandler(
    IUserAccounts accounts,
    ISessions sessions,
    ISessionCache sessionCache,
    IManagerRosterLock rosterLock,
    ManagerGuard guard,
    IRequestContext requestContext,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time)
{
    private const string UserTarget = "User";

    /// <summary>Locks the person.</summary>
    /// <param name="id">The account to lock.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// Success (also when already locked), a 401 when the token names no user, a 404 when the person does not exist or was deleted, a
    /// 422 for the caller's own account or the last active Manager, or a 409 when two saves lost a race.
    /// </returns>
    public async Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, callerId, token), cancellationToken),
                Result.Failure<bool>(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
        if (outcome.IsFailure)
        {
            return Result.Failure(outcome.Error);
        }

        // After the commit, so the next request reads the revoked sessions and not a cached "active" answer.
        if (outcome.Value)
        {
            await sessionCache.EvictUserAsync(id, cancellationToken).ConfigureAwait(false);
        }

        return Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, Guid callerId, CancellationToken cancellationToken)
    {
        // First, before anything is read: a second request waits here until the first has committed.
        await rosterLock.LockActiveManagersAsync(cancellationToken).ConfigureAwait(false);

        var target = await accounts.FindByIdAsync(id, cancellationToken).ConfigureAwait(false);
        if (target is null || target.IsDeleted)
        {
            return Result.Failure<bool>(UserErrors.NotFound);
        }

        var allowed = await guard.CheckAsync(target, callerId, removesActiveManager: true, cancellationToken).ConfigureAwait(false);
        if (allowed.IsFailure)
        {
            return Result.Failure<bool>(allowed.Error);
        }

        // Identity saves on the shared context, so it goes first; the revocation and the audit rows are added after it.
        var now = time.GetUtcNow();
        if (!await accounts.SetManagerLockAsync(id, now, cancellationToken).ConfigureAwait(false))
        {
            return Result.Success(false);
        }

        var key = AuditKey.Of(id);
        var revoked = await sessions.RevokeAllAsync(id, null, SessionRevocationReason.AccountChanged, now, cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.UserLocked, UserTarget, key, null);
        if (revoked.Count > 0)
        {
            audit.Record(AuditActions.SessionsRevoked, UserTarget, key, AuditActions.DetailAccountChanged);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
