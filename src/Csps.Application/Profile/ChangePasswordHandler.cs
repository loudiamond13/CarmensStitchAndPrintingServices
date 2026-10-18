using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using FluentValidation;

namespace Csps.Application.Profile;

/// <summary>
/// Use case: the caller changes their own password from My Profile (PROF-03). The current password must match, the new
/// one meets the full rule (the breach lookup runs before the transaction), and on success every other device of the
/// caller is signed out while this one stays signed in. The target is always the token's user (CWE-639), and neither
/// password reaches a log, an audit entry or a response.
/// </summary>
public sealed class ChangePasswordHandler(
    IUserAccounts accounts,
    ISessions sessions,
    ISessionCache sessionCache,
    PasswordRules passwordRules,
    IEmailOutbox outbox,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<ChangePasswordRequest> validator,
    TimeProvider time)
{
    private const string UserTarget = "User";

    /// <summary>Changes the password.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 400 on the field that failed, a 401 when the token names no usable account, or a 409 when two saves lost a race.</returns>
    public async Task<Result> HandleAsync(ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        // Without both ids the keep-this-device rule cannot hold, so nothing changes (D-05).
        if (requestContext.UserId is not { } userId || requestContext.SessionId is not { } sessionId)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure(ValidationResults.ToError(validation, AuthErrors.ValidationCode, AuthErrors.ValidationMessage));
        }

        var account = await accounts.FindByIdAsync(userId, cancellationToken).ConfigureAwait(false);
        if (account is null || account.IsBlocked)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        var current = request.CurrentPassword!;
        var next = request.NewPassword!;
        if (await accounts.CheckPasswordAsync(account.Id, current, cancellationToken).ConfigureAwait(false) == PasswordCheck.Failed)
        {
            return Result.Failure(ProfileErrors.WrongPassword);
        }

        // Compared as typed, not looked up, because the current password is known to be right at this point.
        if (string.Equals(PasswordPolicy.Normalize(current), PasswordPolicy.Normalize(next), StringComparison.Ordinal))
        {
            return Result.Failure(AuthErrors.NewPasswordRejected(SetNewPasswordHandler.SameAsCurrentMessage));
        }

        var verdict = await passwordRules
            .CheckAsync(next, new PersonalInfo(account.Email, account.FirstName, account.LastName), BreachCheckMode.FailOpenWithFloor, cancellationToken)
            .ConfigureAwait(false);
        if (verdict.Status != PasswordRulesStatus.Accepted)
        {
            return Result.Failure(AuthErrors.NewPasswordRejected(verdict.Message ?? PasswordRules.CheckUnavailableMessage));
        }

        return await ConflictRetry
            .RunAsync(() => SaveAsync(account, sessionId, next, verdict.BreachCheckSkipped, cancellationToken), Result.Failure(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
    }

    private async Task<Result> SaveAsync(UserAccount account, Guid sessionId, string newPassword, bool breachCheckSkipped, CancellationToken cancellationToken)
    {
        await unitOfWork.InTransactionAsync(
            token => ApplyAsync(account, sessionId, newPassword, breachCheckSkipped, token), cancellationToken).ConfigureAwait(false);

        // After the commit, so no request can cache "active" for a session that was just revoked.
        await sessionCache.EvictUserAsync(account.Id, cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    // Identity changes first (Pitfall 13): UserManager saves the shared context, so the session, email and audit rows
    // are added only after it, and one SaveChanges commits them together.
    private async Task<bool> ApplyAsync(UserAccount account, Guid sessionId, string newPassword, bool breachCheckSkipped, CancellationToken cancellationToken)
    {
        var now = time.GetUtcNow();
        var key = AuditKey.Of(account.Id);
        await accounts.SetPasswordAsync(account.Id, newPassword, cancellationToken).ConfigureAwait(false);
        await accounts.ResetFailedCountAsync(account.Id, cancellationToken).ConfigureAwait(false);
        if (breachCheckSkipped)
        {
            await accounts.MarkBreachRecheckAsync(account.Id, cancellationToken).ConfigureAwait(false);
        }
        else
        {
            await accounts.ClearBreachRecheckAsync(account.Id, cancellationToken).ConfigureAwait(false);
        }

        var revoked = await sessions
            .RevokeAllAsync(account.Id, sessionId, SessionRevocationReason.PasswordChanged, now, cancellationToken).ConfigureAwait(false);
        await outbox.EnqueueAsync(new PasswordChangedEmail(account.Email, now, SessionsEnded: true, OtherDevicesOnly: true), cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.PasswordChanged, UserTarget, key, "profile");
        if (revoked.Count > 0)
        {
            audit.Record(AuditActions.SessionsRevoked, UserTarget, key, "password-changed");
        }

        if (breachCheckSkipped)
        {
            audit.Record(AuditActions.BreachCheckUnavailable, UserTarget, key, null);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return true;
    }
}
