using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Users;

/// <summary>
/// Use case: a Manager reactivates a staff account (USER-03, USER-05, D-16, D-19, D-21). It mirrors deactivation: one transaction switches
/// the account on, ends any session still open, and records <c>user.activated</c>; the session cache forgets the person after the
/// commit. An account that is already active is a success that changes and records nothing. Reactivating never removes a Manager, so it
/// takes no roster lock, but a Manager still cannot act on their own account.
/// </summary>
public sealed class ActivateUserHandler(
    IUserAccounts accounts,
    ISessions sessions,
    ISessionCache sessionCache,
    ManagerGuard guard,
    IRequestContext requestContext,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time)
{
    private const string UserTarget = "User";
    private const string AccountChangedDetail = "account-changed";

    /// <summary>Reactivates the person.</summary>
    /// <param name="id">The account to reactivate.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// Success (also when already active), a 401 when the token names no user, a 404 when the person does not exist or was deleted, a 422
    /// for the caller's own account, or a 409 when two saves lost a race.
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

        if (outcome.Value)
        {
            await sessionCache.EvictUserAsync(id, cancellationToken).ConfigureAwait(false);
        }

        return Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, Guid callerId, CancellationToken cancellationToken)
    {
        var target = await accounts.FindByIdAsync(id, cancellationToken).ConfigureAwait(false);
        if (target is null || target.IsDeleted)
        {
            return Result.Failure<bool>(UserErrors.NotFound);
        }

        var allowed = await guard.CheckAsync(target, callerId, removesActiveManager: false, cancellationToken).ConfigureAwait(false);
        if (allowed.IsFailure)
        {
            return Result.Failure<bool>(allowed.Error);
        }

        if (!await accounts.SetActiveAsync(id, true, cancellationToken).ConfigureAwait(false))
        {
            return Result.Success(false);
        }

        var key = AuditKey.Of(id);
        var revoked = await sessions
            .RevokeAllAsync(id, null, SessionRevocationReason.AccountChanged, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.UserActivated, UserTarget, key, null);
        if (revoked.Count > 0)
        {
            audit.Record(AuditActions.SessionsRevoked, UserTarget, key, AccountChangedDetail);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
