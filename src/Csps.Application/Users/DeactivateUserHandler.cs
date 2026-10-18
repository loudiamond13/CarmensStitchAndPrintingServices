using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Users;

/// <summary>
/// Use case: a Manager deactivates a staff account (USER-03, USER-05, D-16, D-21). In one transaction the account is switched off,
/// every session of that person ends, and the audit trail records <c>user.deactivated</c> and the revocation. The person is then
/// forgotten by the session cache, so their next request with an old token is a 401. An account that is already inactive is a
/// success that changes and records nothing. No version is sent: the change applies to the latest state.
/// </summary>
public sealed class DeactivateUserHandler(
    IUserAccounts accounts,
    ISessions sessions,
    ISessionCache sessionCache,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time)
{
    private const string UserTarget = "User";
    private const string AccountChangedDetail = "account-changed";

    /// <summary>Deactivates the person.</summary>
    /// <param name="id">The account to deactivate.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success (also when already inactive), a 404 when the person does not exist or was deleted, or a 409 when two saves lost a race.</returns>
    public async Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, token), cancellationToken),
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

    private async Task<Result<bool>> AttemptAsync(Guid id, CancellationToken cancellationToken)
    {
        var target = await accounts.FindByIdAsync(id, cancellationToken).ConfigureAwait(false);
        if (target is null || target.IsDeleted)
        {
            return Result.Failure<bool>(UserErrors.NotFound);
        }

        // Identity saves on the shared context, so it goes first; the revocation and the audit rows are added after it.
        if (!await accounts.SetActiveAsync(id, false, cancellationToken).ConfigureAwait(false))
        {
            return Result.Success(false);
        }

        var key = AuditKey.Of(id);
        var revoked = await sessions
            .RevokeAllAsync(id, null, SessionRevocationReason.AccountChanged, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.UserDeactivated, UserTarget, key, null);
        if (revoked.Count > 0)
        {
            audit.Record(AuditActions.SessionsRevoked, UserTarget, key, AccountChangedDetail);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
