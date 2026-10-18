using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Users;

/// <summary>
/// Use case: a Manager calls off another person's waiting email change (USER-03, C-9, D-21). One transaction, under the per-account link
/// lock, revokes the open links, clears the pending address and records <c>profile.email-change-canceled</c> with the Manager as the actor.
/// With nothing waiting it succeeds and writes nothing, so a repeat is harmless and no version is sent. A Manager never does this to
/// their own account (D-19): My Profile has the same action for them. The sign-in email never changes here.
/// </summary>
public sealed class CancelUserEmailChangeHandler(
    IUserAccounts accounts,
    IUserDirectory directory,
    IAccountTokens tokens,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    TimeProvider time)
{
    private const string UserTarget = "User";

    /// <summary>Cancels the waiting change.</summary>
    /// <param name="id">The account whose change is called off.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// Success (also when nothing was waiting), a 401 when the token names no user, a 404 when the person does not exist or was deleted, a
    /// 422 for the caller's own account, or a 409 when two saves lost a race.
    /// </returns>
    public async Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        if (id == callerId)
        {
            return Result.Failure(UserErrors.OwnAccount);
        }

        return await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => CancelAsync(id, token), cancellationToken),
                Result.Failure(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
    }

    private async Task<Result> CancelAsync(Guid id, CancellationToken cancellationToken)
    {
        await tokens.LockAccountAsync(id, cancellationToken).ConfigureAwait(false);

        var target = await accounts.FindByIdAsync(id, cancellationToken).ConfigureAwait(false);
        if (target is null || target.IsDeleted)
        {
            return Result.Failure(UserErrors.NotFound);
        }

        var profile = await directory.GetProfileAsync(id, cancellationToken).ConfigureAwait(false);
        if (profile?.PendingEmail is not { Length: > 0 })
        {
            return Result.Success();
        }

        await tokens.RevokeOpenAsync(id, AccountTokenPurpose.EmailChange, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);

        // Identity saves on the shared context, so the pending address goes first and the audit entry follows.
        await accounts.SetPendingEmailAsync(id, null, cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.ProfileEmailChangeCanceled, UserTarget, AuditKey.Of(id), null);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }
}
