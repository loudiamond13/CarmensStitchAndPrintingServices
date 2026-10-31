using Csps.Application.Common;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using FluentValidation;

namespace Csps.Application.Auth;

/// <summary>
/// Use case: the must-change step after the emailed code (AUTH-09, AUTH-11, D-13, D-22). Only the pending sign-in that
/// passed the code step may set the new password; the full rule applies (breach check failing open to the floor, D-14).
/// One transaction spends the sign-in, saves the password, clears the flag, ends the earlier sessions, starts the new
/// session and audits it, or does none of that. No session exists before this succeeds.
/// </summary>
public sealed class SetNewPasswordHandler(
    ITwoFactorChallenges challenges,
    IUserAccounts accounts,
    ISessions sessions,
    ISessionCache sessionCache,
    PasswordRules passwordRules,
    SessionIssuer sessionIssuer,
    IEmailOutbox outbox,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IValidator<SetNewPasswordRequest> validator,
    TimeProvider time)
{
    /// <summary>Gets the message for a new password that equals the current one (a temporary or breached password must be replaced).</summary>
    public const string SameAsCurrentMessage = "Choose a different password from your current one.";

    private const string UserTarget = "User";
    private const string SessionTarget = "UserSession";

    /// <summary>Saves the new password and signs the person in.</summary>
    /// <param name="ticket">The pending-login ticket from its cookie; null or empty when the cookie is missing.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The started session, a 400 on the password, or a 401 when the pending sign-in cannot take a new password.</returns>
    public async Task<Result<IssuedSession>> HandleAsync(string? ticket, SetNewPasswordRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        try
        {
            return await ApplyAsync(ticket, request, cancellationToken).ConfigureAwait(false);
        }
        catch (ConcurrencyConflictException)
        {
            // The same ticket was submitted twice at once and the other submission saved first.
            return Result.Failure<IssuedSession>(AuthErrors.TicketExpired);
        }
    }


    private async Task<Result<IssuedSession>> ApplyAsync(string? ticket, SetNewPasswordRequest request, CancellationToken cancellationToken)
    {
        var now = time.GetUtcNow();
        var pending = await PendingPasswordChangeLookup.FindAsync(ticket, now, challenges, accounts, cancellationToken).ConfigureAwait(false);
        if (pending is null)
        {
            return Result.Failure<IssuedSession>(AuthErrors.TicketExpired);
        }

        var challenge = pending.Challenge;
        var user = pending.Account;

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<IssuedSession>(ValidationResults.ToError(validation, AuthErrors.ValidationCode, AuthErrors.ValidationMessage));
        }

        var verdict = await passwordRules
            .CheckAsync(request.NewPassword!, new PersonalInfo(user.Email, user.FirstName, user.LastName), BreachCheckMode.FailOpenWithFloor, cancellationToken)
            .ConfigureAwait(false);
        if (verdict.Status != PasswordRulesStatus.Accepted)
        {
            return Result.Failure<IssuedSession>(AuthErrors.NewPasswordRejected(verdict.Message ?? PasswordRules.CheckUnavailableMessage));
        }

        // The point of this step is to replace the temporary or breached password, so the same value is refused.
        if (await accounts.CheckPasswordAsync(user.Id, request.NewPassword!, cancellationToken).ConfigureAwait(false) == PasswordCheck.Succeeded)
        {
            return Result.Failure<IssuedSession>(AuthErrors.NewPasswordRejected(SameAsCurrentMessage));
        }

        var issued = await unitOfWork.InTransactionAsync(
            token => SaveAsync(challenge, user, request.NewPassword!, verdict.BreachCheckSkipped, now, token), cancellationToken).ConfigureAwait(false);

        // After the commit, so no request can cache "active" for a session that was just revoked.
        await sessionCache.EvictUserAsync(user.Id, cancellationToken).ConfigureAwait(false);
        return Result.Success(issued);
    }

    // The sign-in is spent and saved first, so a second request on the same ticket loses before any other change.
    private async Task<IssuedSession> SaveAsync(
        TwoFactorChallenge challenge, UserAccount user, string newPassword, bool breachCheckSkipped, DateTimeOffset now, CancellationToken cancellationToken)
    {
        challenge.Complete(now);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        // Identity changes first (Pitfall 13): UserManager saves the shared context, so the session, email and audit
        // rows are added only after it, and one SaveChanges commits them together.
        await accounts.SetPasswordAsync(user.Id, newPassword, cancellationToken).ConfigureAwait(false);
        await accounts.ClearMustChangePasswordAsync(user.Id, cancellationToken).ConfigureAwait(false);
        if (breachCheckSkipped)
        {
            await accounts.MarkBreachRecheckAsync(user.Id, cancellationToken).ConfigureAwait(false);
        }
        else
        {
            await accounts.ClearBreachRecheckAsync(user.Id, cancellationToken).ConfigureAwait(false);
        }

        // A changed password ends every earlier session (a breached password may already be in use); the new one starts after.
        await sessions.RevokeAllAsync(user.Id, null, SessionRevocationReason.PasswordReset, now, cancellationToken).ConfigureAwait(false);
        var issued = await sessionIssuer.StartAsync(user, challenge.Persistent, cancellationToken).ConfigureAwait(false);
        await outbox.EnqueueAsync(new PasswordChangedEmail(user.Email, now, false), cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.PasswordChanged, UserTarget, AuditKey.Of(user.Id), null);
        audit.Record(AuditActions.SessionsRevoked, UserTarget, AuditKey.Of(user.Id), AuditActions.DetailPasswordReset);
        if (breachCheckSkipped)
        {
            audit.Record(AuditActions.BreachCheckUnavailable, UserTarget, AuditKey.Of(user.Id), null);
        }

        audit.Record(AuditActions.SignedIn, SessionTarget, AuditKey.Of(issued.SessionId), null);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return issued;
    }
}
