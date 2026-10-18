using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Users;

/// <summary>
/// Use case: a Manager deletes a staff account for good (USER-03, USER-05, D-07..D-11, D-21). The row is kept so the records the person
/// created still show their name, but their address is scrambled (the real one is free again), every session ends, every open link of
/// any kind stops working and sign-in is impossible. In one transaction the account is changed, the sessions and links are revoked, and
/// the audit trail records <c>user.deleted</c> (and the revocation, when a session was open). The person is then forgotten by the session
/// cache. A person who does not exist or was already deleted is a 404 that changes and records nothing. No version is sent: the delete
/// applies to the latest state.
/// </summary>
public sealed class DeleteUserHandler(
    IUserAccounts accounts,
    ISessions sessions,
    ISessionCache sessionCache,
    IAccountTokens tokens,
    IRequestContext requestContext,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time)
{
    private const string UserTarget = "User";
    private const string AccountChangedDetail = "account-changed";

    private static readonly AccountTokenPurpose[] Purposes =
        [AccountTokenPurpose.Invitation, AccountTokenPurpose.PasswordReset, AccountTokenPurpose.EmailChange];

    /// <summary>Deletes the person.</summary>
    /// <param name="id">The account to delete.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 401 when the token names no user, a 404 when the person does not exist or was already deleted, or a 409 when two saves lost a race.</returns>
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

        // After the commit, so the next request reads the revoked sessions and not a cached "active" answer.
        await sessionCache.EvictUserAsync(id, cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, CancellationToken cancellationToken)
    {
        var target = await accounts.FindByIdAsync(id, cancellationToken).ConfigureAwait(false);
        if (target is null || target.IsDeleted)
        {
            return Result.Failure<bool>(UserErrors.NotFound);
        }

        // Identity saves on the shared context, so it goes first; the revocations and the audit rows are added after it.
        var now = time.GetUtcNow();
        if (!await accounts.SoftDeleteAsync(id, now, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<bool>(UserErrors.NotFound);
        }

        foreach (var purpose in Purposes)
        {
            _ = await tokens.RevokeOpenAsync(id, purpose, now, cancellationToken).ConfigureAwait(false);
        }

        var key = AuditKey.Of(id);
        var revoked = await sessions.RevokeAllAsync(id, null, SessionRevocationReason.AccountChanged, now, cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.UserDeleted, UserTarget, key, null);
        if (revoked.Count > 0)
        {
            audit.Record(AuditActions.SessionsRevoked, UserTarget, key, AccountChangedDetail);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
