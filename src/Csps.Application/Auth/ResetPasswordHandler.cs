using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using FluentValidation;

namespace Csps.Application.Auth;

/// <summary>
/// Use case: set a new password from an emailed link (AUTH-09, D-17, D-19). The new password follows the full rule with
/// the breach check failing open to the common-password floor (D-14). One transaction spends the link, saves the
/// password, ends any lockout and every session, queues the "password changed" email and audits it, or does none of
/// that. Nobody is signed in afterwards, and a deactivated account never resets into an active one.
/// </summary>
public sealed class ResetPasswordHandler(
    IAccountTokens tokens,
    IUserAccounts accounts,
    ISessions sessions,
    ISessionCache sessionCache,
    PasswordRules passwordRules,
    IEmailOutbox outbox,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IValidator<ResetPasswordRequest> validator,
    TimeProvider time)
{
    private const string UserTarget = "User";

    /// <summary>Handles one reset.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 400 on the password, a 404 for a link that does not work, or a 409 when two saves lost a race.</returns>
    public async Task<Result> HandleAsync(ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure(ValidationResults.ToError(validation, AuthErrors.ValidationCode, AuthErrors.ValidationMessage));
        }

        // The second pass of a lost race reads the link again, so a link spent by the winner reads as invalid.
        var outcome = await ConflictRetry.RunAsync(() => AttemptAsync(request, cancellationToken), new Outcome(Result.Failure(AuthErrors.SessionBusy), null))
            .ConfigureAwait(false);

        if (outcome.EvictUser is { } userId)
        {
            // After the commit, so no request can cache "active" for a session that is about to be revoked.
            await sessionCache.EvictUserAsync(userId, cancellationToken).ConfigureAwait(false);
        }
        else if (outcome.Result.IsFailure && outcome.Result.Error.Code == AuthErrors.LinkInvalidCode)
        {
            await audit.RecordIndependentlyAsync(AuditActions.PasswordResetLinkInvalid, null, null, null, cancellationToken).ConfigureAwait(false);
        }

        return outcome.Result;
    }

    private static string Key(Guid id) => id.ToString("D", CultureInfo.InvariantCulture);

    private Task<Outcome> AttemptAsync(ResetPasswordRequest request, CancellationToken cancellationToken) =>
        unitOfWork.InTransactionAsync(
            async token =>
            {
                var now = time.GetUtcNow();
                var link = await ResetLinkLookup.FindAsync(request.Token, now, tokens, accounts, token).ConfigureAwait(false);
                if (link is null)
                {
                    return new Outcome(Result.Failure(AuthErrors.LinkInvalid), null);
                }

                var account = link.Account;
                var verdict = await passwordRules
                    .CheckAsync(request.NewPassword!, new PersonalInfo(account.Email, account.FirstName, account.LastName), BreachCheckMode.FailOpenWithFloor, token)
                    .ConfigureAwait(false);
                if (verdict.Status != PasswordRulesStatus.Accepted)
                {
                    return new Outcome(Result.Failure(AuthErrors.NewPasswordRejected(verdict.Message ?? PasswordRules.CheckUnavailableMessage)), null);
                }

                // Spend the link first and save at once: a second request racing on the same link loses here, before any other change.
                link.Token.Use(now);
                await tokens.RevokeOpenAsync(account.Id, AccountTokenPurpose.PasswordReset, now, token).ConfigureAwait(false);
                await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);

                await ApplyAsync(account, request.NewPassword!, verdict.BreachCheckSkipped, now, token).ConfigureAwait(false);
                await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                return new Outcome(Result.Success(), account.Id);
            },
            cancellationToken);

    private async Task ApplyAsync(UserAccount account, string newPassword, bool breachCheckSkipped, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var id = account.Id;
        await accounts.SetPasswordAsync(id, newPassword, cancellationToken).ConfigureAwait(false);
        await accounts.ClearLockoutAsync(id, cancellationToken).ConfigureAwait(false);
        await accounts.ClearMustChangePasswordAsync(id, cancellationToken).ConfigureAwait(false);

        if (breachCheckSkipped)
        {
            await accounts.MarkBreachRecheckAsync(id, cancellationToken).ConfigureAwait(false);
            audit.Record(AuditActions.BreachCheckUnavailable, UserTarget, Key(id), null);
        }
        else
        {
            await accounts.ClearBreachRecheckAsync(id, cancellationToken).ConfigureAwait(false);
        }

        // Every session ends, the one that asked included; a reset signs nobody in (D-17).
        await sessions.RevokeAllAsync(id, null, SessionRevocationReason.PasswordReset, now, cancellationToken).ConfigureAwait(false);
        await outbox.EnqueueAsync(new PasswordChangedEmail(account.Email, now, true), cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.PasswordResetCompleted, UserTarget, Key(id), null);
        audit.Record(AuditActions.SessionsRevoked, UserTarget, Key(id), "password-reset");
    }

    // EvictUser is set only for a committed reset.
    private sealed record Outcome(Result Result, Guid? EvictUser);
}
