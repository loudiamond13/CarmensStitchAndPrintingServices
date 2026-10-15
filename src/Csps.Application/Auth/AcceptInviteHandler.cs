using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using FluentValidation;

namespace Csps.Application.Auth;

/// <summary>
/// Use case: set the first password from an emailed invite (AUTH-12, D-14, D-29). The password follows the full rule and
/// the breach check fails closed: when the list cannot be reached nothing is saved and the invite still works. One
/// transaction spends the invite, saves the password, confirms the address the invite went to and audits it, or does
/// none of that. No session is issued; the person signs in normally afterwards (password, then the emailed code).
/// </summary>
public sealed class AcceptInviteHandler(
    IAccountTokens tokens,
    IUserAccounts accounts,
    PasswordRules passwordRules,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IValidator<AcceptInviteRequest> validator,
    TimeProvider time)
{
    private const string UserTarget = "User";

    /// <summary>Handles one acceptance.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// Success, a 400 on the password, a 404 for an invite that does not work, a 422 while the breach list cannot be
    /// reached, or a 409 when two saves lost a race.
    /// </returns>
    public async Task<Result> HandleAsync(AcceptInviteRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure(ValidationResults.ToError(validation, AuthErrors.ValidationCode, AuthErrors.ValidationMessage));
        }

        // The second pass of a lost race reads the invite again, so one spent by the winner reads as invalid.
        var outcome = await ConflictRetry.RunAsync(() => AttemptAsync(request, cancellationToken), new Outcome(Result.Failure(AuthErrors.SessionBusy), null))
            .ConfigureAwait(false);

        if (outcome.CheckUnavailableFor is { } userId)
        {
            await audit.RecordIndependentlyAsync(AuditActions.BreachCheckUnavailable, UserTarget, Key(userId), "invite", cancellationToken).ConfigureAwait(false);
        }

        return outcome.Result;
    }

    private static string Key(Guid id) => id.ToString("D", CultureInfo.InvariantCulture);

    private Task<Outcome> AttemptAsync(AcceptInviteRequest request, CancellationToken cancellationToken) =>
        unitOfWork.InTransactionAsync(
            async token =>
            {
                var now = time.GetUtcNow();
                var invite = await InviteLinkLookup.FindAsync(request.Token, now, tokens, accounts, token).ConfigureAwait(false);
                if (invite is null)
                {
                    return new Outcome(Result.Failure(AuthErrors.InviteInvalid), null);
                }

                var account = invite.Account;
                var verdict = await passwordRules
                    .CheckAsync(request.NewPassword!, new PersonalInfo(account.Email, account.FirstName, account.LastName), BreachCheckMode.FailClosed, token)
                    .ConfigureAwait(false);
                if (verdict.Status == PasswordRulesStatus.CheckUnavailable)
                {
                    return new Outcome(Result.Failure(AuthErrors.BreachCheckUnavailable), account.Id);
                }

                if (verdict.Status != PasswordRulesStatus.Accepted)
                {
                    return new Outcome(Result.Failure(AuthErrors.NewPasswordRejected(verdict.Message ?? PasswordRules.CheckUnavailableMessage)), null);
                }

                // Spend the invite first and save at once: a second request racing on the same invite loses here.
                invite.Token.Use(now);
                await tokens.RevokeOpenAsync(account.Id, AccountTokenPurpose.Invitation, now, token).ConfigureAwait(false);
                await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);

                await accounts.SetPasswordAsync(account.Id, request.NewPassword!, token).ConfigureAwait(false);
                await accounts.ConfirmEmailAsync(account.Id, token).ConfigureAwait(false);
                audit.Record(AuditActions.InviteAccepted, UserTarget, Key(account.Id), null);
                await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                return new Outcome(Result.Success(), null);
            },
            cancellationToken);

    // CheckUnavailableFor is set only when the breach list could not be reached, so that refusal is audited.
    private sealed record Outcome(Result Result, Guid? CheckUnavailableFor);
}
