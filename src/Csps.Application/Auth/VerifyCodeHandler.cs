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
/// Use case: the emailed code step of staff sign-in (AUTH-02, AUTH-03, D-13, D-39). A correct code for the pending
/// ticket starts the session, or hands over to the set-new-password step for an account that must change its password.
/// </summary>
public sealed class VerifyCodeHandler(
    ITwoFactorChallenges challenges,
    IUserAccounts accounts,
    ICodeMac codeMac,
    SessionIssuer sessionIssuer,
    IEmailOutbox outbox,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IValidator<VerifyCodeRequest> validator,
    AuthSettings settings,
    TimeProvider time)
{
    private const string UserTarget = "User";
    private const string SessionTarget = "UserSession";

    /// <summary>Checks a typed code against the pending sign-in.</summary>
    /// <param name="ticket">The pending-login ticket from its cookie; null or empty when the cookie is missing.</param>
    /// <param name="request">The code form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The next step, a 400 for a malformed code, or a 401 when the pending sign-in is gone.</returns>
    public async Task<Result<VerifyCodeOutcome>> HandleAsync(string? ticket, VerifyCodeRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        try
        {
            return await CheckAsync(ticket, request, cancellationToken).ConfigureAwait(false);
        }
        catch (ConcurrencyConflictException)
        {
            // The same ticket was submitted twice at once and the other submission saved first.
            return Result.Failure<VerifyCodeOutcome>(AuthErrors.TicketExpired);
        }
    }

    private async Task<Result<VerifyCodeOutcome>> CheckAsync(string? ticket, VerifyCodeRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(ticket))
        {
            return Result.Failure<VerifyCodeOutcome>(AuthErrors.TicketExpired);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<VerifyCodeOutcome>(ValidationResults.ToError(validation, AuthErrors.ValidationCode, AuthErrors.ValidationMessage));
        }

        var challenge = await challenges.FindByTicketHashAsync(TokenHash.Compute(ticket), cancellationToken).ConfigureAwait(false);
        if (challenge is null)
        {
            return Result.Failure<VerifyCodeOutcome>(AuthErrors.TicketExpired);
        }

        var user = await accounts.FindByIdAsync(challenge.UserId, cancellationToken).ConfigureAwait(false);
        if (user is null || !user.IsActive || (user.LockoutEnd is { } lockedUntil && lockedUntil > time.GetUtcNow()))
        {
            return Result.Failure<VerifyCodeOutcome>(AuthErrors.TicketExpired);
        }

        var now = time.GetUtcNow();
        var twoFactor = settings.ToTwoFactorSettings();
        var mac = codeMac.Compute(challenge.Id, user.Id, request.Code!);
        var failuresBefore = challenge.FailedAttemptsSince(DateTimeOffset.MinValue);
        var verdict = challenge.Verify(mac, now, twoFactor);
        var failureRecorded = challenge.FailedAttemptsSince(DateTimeOffset.MinValue) > failuresBefore;

        return verdict.Outcome switch
        {
            TwoFactorVerifyOutcome.Ok => Result.Success(await AcceptAsync(challenge, user, now, cancellationToken).ConfigureAwait(false)),
            TwoFactorVerifyOutcome.CodeExpired => Result.Failure<VerifyCodeOutcome>(AuthErrors.CodeExpired),
            TwoFactorVerifyOutcome.Wrong or TwoFactorVerifyOutcome.Exhausted =>
                Result.Failure<VerifyCodeOutcome>(await RejectAsync(user, verdict.Outcome, failureRecorded, now, twoFactor, cancellationToken).ConfigureAwait(false)),
            _ => Result.Failure<VerifyCodeOutcome>(AuthErrors.TicketExpired),
        };
    }

    private static string Key(Guid id) => id.ToString("D", CultureInfo.InvariantCulture);

    // A correct code: either a session starts, or the account is handed to the set-new-password step (D-13).
    private async Task<VerifyCodeOutcome> AcceptAsync(TwoFactorChallenge challenge, UserAccount user, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (user.MustChangePassword is { } reason)
        {
            challenge.RequirePasswordChange(reason);
            audit.Record(AuditActions.TwoFactorVerified, UserTarget, Key(user.Id), null);
            await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return new VerifyCodeOutcome(VerifyNext.SetNewPassword, reason, null);
        }

        challenge.Complete(now);
        var issued = await sessionIssuer.StartAsync(user, challenge.Persistent, cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.TwoFactorVerified, UserTarget, Key(user.Id), null);
        audit.Record(AuditActions.SignedIn, SessionTarget, Key(issued.SessionId), null);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return new VerifyCodeOutcome(VerifyNext.SignedIn, null, issued);
    }

    // A wrong or used-up code. The wrong try is committed before the answer, and the account cap (counted across every
    // sign-in of the last hour) is checked first so the tenth wrong code wins over the used-up message.
    private async Task<Error> RejectAsync(
        UserAccount user, TwoFactorVerifyOutcome outcome, bool failureRecorded, DateTimeOffset now, TwoFactorSettings twoFactor, CancellationToken cancellationToken)
    {
        if (failureRecorded)
        {
            var earlier = await challenges.CountFailedAttemptsSinceAsync(user.Id, now - twoFactor.AccountFailureWindow, cancellationToken).ConfigureAwait(false);
            if (TwoFactorLimits.AccountCapReached(earlier + 1, twoFactor))
            {
                await LockAsync(user, now, cancellationToken).ConfigureAwait(false);
                await audit.RecordIndependentlyAsync(AuditActions.TwoFactorFailed, UserTarget, Key(user.Id), null, cancellationToken).ConfigureAwait(false);
                return AuthErrors.CodeLockout;
            }

            await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        var exhausted = outcome == TwoFactorVerifyOutcome.Exhausted;
        await audit.RecordIndependentlyAsync(
            exhausted ? AuditActions.TwoFactorExhausted : AuditActions.TwoFactorFailed, UserTarget, Key(user.Id), null, cancellationToken).ConfigureAwait(false);
        return exhausted ? AuthErrors.CodeUsedUp : AuthErrors.CodeWrong;
    }

    // Cancels every open sign-in, pauses the account and queues the one email, all with the failed try (T-04-46).
    private async Task LockAsync(UserAccount user, DateTimeOffset now, CancellationToken cancellationToken) =>
        await unitOfWork.InTransactionAsync(
            async token =>
            {
                var until = now + settings.CodeLockoutDuration;
                await challenges.InvalidateOpenAsync(user.Id, now, token).ConfigureAwait(false);
                await accounts.LockUntilAsync(user.Id, until, token).ConfigureAwait(false);
                await outbox.EnqueueAsync(new AccountLockedEmail(user.Email, until, LockoutCause.Code), token).ConfigureAwait(false);
                audit.Record(AuditActions.Lockout, UserTarget, Key(user.Id), "code");
                await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                return true;
            },
            cancellationToken).ConfigureAwait(false);
}
