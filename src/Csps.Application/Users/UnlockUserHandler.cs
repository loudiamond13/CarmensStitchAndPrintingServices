using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Users;

/// <summary>
/// Use case: a Manager lifts the Manager lock on a staff account (USER-03, USER-05, D-16, D-21). It mirrors locking: one transaction
/// clears the lock, ends any session still open, and records <c>user.unlocked</c>; the session cache forgets the person after the
/// commit. It never touches the 15-minute failed-password lockout. An account that is not locked is a success that changes and
/// records nothing. Unlocking never removes a Manager, so it takes no roster lock and runs no guard.
/// </summary>
public sealed class UnlockUserHandler(
    IUserAccounts accounts,
    ISessions sessions,
    ISessionCache sessionCache,
    IRequestContext requestContext,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time)
{
    private const string UserTarget = "User";

    /// <summary>Unlocks the person.</summary>
    /// <param name="id">The account to unlock.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// Success (also when not locked), a 401 when the token names no user, a 404 when the person does not exist or was deleted, or a 409
    /// when two saves lost a race.
    /// </returns>
    public async Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is null)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, token), cancellationToken),
                Result.Failure<bool>(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
        if (outcome.IsFailure)
        {
            return Result.Failure(outcome.Error);
        }

        if (outcome.Value)
        {
            await sessionCache.EvictUserAsync(id, cancellationToken).ConfigureAwait(false);
        }

        return Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, CancellationToken cancellationToken)
    {
        var target = await accounts.FindByIdAsync(id, cancellationToken).ConfigureAwait(false);
        if (target is null || target.IsDeleted)
        {
            return Result.Failure<bool>(UserErrors.NotFound);
        }

        if (!await accounts.SetManagerLockAsync(id, null, cancellationToken).ConfigureAwait(false))
        {
            return Result.Success(false);
        }

        var key = AuditKey.Of(id);
        var revoked = await sessions
            .RevokeAllAsync(id, null, SessionRevocationReason.AccountChanged, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.UserUnlocked, UserTarget, key, null);
        if (revoked.Count > 0)
        {
            audit.Record(AuditActions.SessionsRevoked, UserTarget, key, AuditActions.DetailAccountChanged);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
