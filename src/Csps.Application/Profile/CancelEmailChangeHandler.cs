using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Profile;

/// <summary>
/// Use case: the caller calls off a waiting email change (PROF-02, D-24). One transaction, under the per-account link lock,
/// revokes the open links, clears the pending address and audits the cancel by user id only. With nothing waiting it
/// succeeds and writes nothing, so a repeat is harmless and no row version is needed. The sign-in email never changes here.
/// </summary>
public sealed class CancelEmailChangeHandler(
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
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success (also when nothing was waiting), a 401 when the token names no usable account, or a 409 when two saves lost a race.</returns>
    public async Task<Result> HandleAsync(CancellationToken cancellationToken)
    {
        if (requestContext.UserId is not { } userId)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        var account = await accounts.FindByIdAsync(userId, cancellationToken).ConfigureAwait(false);
        if (account is null || account.IsBlocked)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        return await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => CancelAsync(account.Id, token), cancellationToken),
                Result.Failure(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
    }

    private async Task<Result> CancelAsync(Guid userId, CancellationToken cancellationToken)
    {
        await tokens.LockAccountAsync(userId, cancellationToken).ConfigureAwait(false);

        var profile = await directory.GetProfileAsync(userId, cancellationToken).ConfigureAwait(false);
        if (profile?.PendingEmail is not { Length: > 0 })
        {
            return Result.Success();
        }

        await tokens.RevokeOpenAsync(userId, AccountTokenPurpose.EmailChange, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);

        // Identity saves on the shared context, so the pending address goes first and the audit entry follows.
        await accounts.SetPendingEmailAsync(userId, null, cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.ProfileEmailChangeCanceled, UserTarget, AuditKey.Of(userId), null);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }
}
