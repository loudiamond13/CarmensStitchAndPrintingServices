using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using FluentValidation;

namespace Csps.Application.Users;

/// <summary>
/// Use case: a Manager sets a temporary password for a colleague (C-4, 04 D-21, 04 D-24, D-14, USER-05). In one transaction the password is
/// hashed and saved, a failed-password lockout ends, the account is marked must-change (Temporary), every session of the person ends
/// (including one open right now), the "your password was reset by a Manager" notice is queued and the audit trail records
/// <c>user.temporary-password-set</c> and, when a session was open, <c>auth.sessions-revoked</c> with detail <c>temporary-password</c>.
/// The person is forgotten by the session cache after the commit. The next sign-in still needs the emailed code (04 D-22) and then forces
/// a new password. The password is never returned, mailed, logged or audited, and only the basic rule applies. A Manager never does this
/// to their own account (D-19) and a deactivated or locked person is refused (D-41 Q5). A person invited but not yet set up gets the
/// password as their first one: the address counts as confirmed, as when an account is added with a temporary password, and the open
/// invitation stops working. For every person, any reset link already emailed stops working too (WR-01). No version is sent: the action acts on the latest state (D-21).
/// </summary>
public sealed class SetTemporaryPasswordHandler(
    IUserAccounts accounts,
    IUserDirectory directory,
    ISessions sessions,
    ISessionCache sessionCache,
    IAccountTokens tokens,
    IEmailOutbox outbox,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<SetTemporaryPasswordRequest> validator,
    TimeProvider time)
{
    private const string UserTarget = "User";

    /// <summary>Sets the temporary password.</summary>
    /// <param name="id">The account that gets the password.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 400 on the password, a 401 when the token names no user, a 404 when the person does not exist or was deleted, a 409 when two saves lost a race, or a 422 for the caller's own account or a blocked person.</returns>
    public async Task<Result> HandleAsync(Guid id, SetTemporaryPasswordRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        if (id == callerId)
        {
            return Result.Failure(UserErrors.OwnAccount);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure(ValidationResults.ToError(validation, AuthErrors.ValidationCode, AuthErrors.ValidationMessage));
        }

        if (await directory.GetProfileAsync(callerId, cancellationToken).ConfigureAwait(false) is not { } manager)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        var managerName = $"{manager.FirstName} {manager.LastName}";
        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => SetAsync(id, request.TemporaryPassword!, managerName, token), cancellationToken),
                Result.Failure(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
        if (outcome.IsFailure)
        {
            return outcome;
        }

        // After the commit, so the next request reads the revoked sessions and not a cached "active" answer.
        await sessionCache.EvictUserAsync(id, cancellationToken).ConfigureAwait(false);
        return outcome;
    }

    private async Task<Result> SetAsync(Guid id, string password, string managerName, CancellationToken cancellationToken)
    {
        await tokens.LockAccountAsync(id, cancellationToken).ConfigureAwait(false);

        var target = await accounts.FindByIdAsync(id, cancellationToken).ConfigureAwait(false);
        if (target is null || target.IsDeleted)
        {
            return Result.Failure(UserErrors.NotFound);
        }

        if (target.IsBlocked)
        {
            return Result.Failure(UserErrors.Blocked);
        }

        var now = time.GetUtcNow();

        // Identity saves on the shared context, so the account changes go first; the revocations, the email and the audit rows follow.
        await accounts.SetPasswordAsync(id, password, cancellationToken).ConfigureAwait(false);
        await accounts.ClearLockoutAsync(id, cancellationToken).ConfigureAwait(false);
        await accounts.SetMustChangePasswordAsync(id, PasswordChangeReason.Temporary, cancellationToken).ConfigureAwait(false);
        await accounts.MarkStaffEditAsync(id, cancellationToken).ConfigureAwait(false);
        if (!target.HasPassword)
        {
            await accounts.ConfirmEmailAsync(id, cancellationToken).ConfigureAwait(false);
            await tokens.RevokeOpenAsync(id, AccountTokenPurpose.Invitation, now, cancellationToken).ConfigureAwait(false);
        }

        await tokens.RevokeOpenAsync(id, AccountTokenPurpose.PasswordReset, now, cancellationToken).ConfigureAwait(false);
        var revoked = await sessions.RevokeAllAsync(id, null, SessionRevocationReason.PasswordReset, now, cancellationToken).ConfigureAwait(false);
        await outbox.EnqueueAsync(new ManagerResetEmail(target.Email, managerName, now), cancellationToken).ConfigureAwait(false);

        var key = AuditKey.Of(id);
        audit.Record(AuditActions.UserTemporaryPasswordSet, UserTarget, key, null);
        if (revoked.Count > 0)
        {
            audit.Record(AuditActions.SessionsRevoked, UserTarget, key, AuditActions.DetailTemporaryPassword);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }
}
