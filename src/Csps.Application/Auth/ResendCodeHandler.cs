using System.Globalization;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Auth;

/// <summary>What a sent code hands back to the controller.</summary>
/// <param name="ResendAfterSeconds">How long the page waits before offering another code.</param>
public sealed record ResendCodeOutcome(int ResendAfterSeconds);

/// <summary>
/// Use case: send a new sign-in code for the pending ticket (AUTH-04, D-10, D-33). A code needs the 60 second cooldown
/// and at most five codes an hour for the account; the newest code replaces the one before it.
/// </summary>
public sealed class ResendCodeHandler(
    ITwoFactorChallenges challenges,
    IUserAccounts accounts,
    ICodeMac codeMac,
    ISecureRandom random,
    IEmailOutbox outbox,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    AuthSettings settings,
    TimeProvider time)
{
    /// <summary>Sends a new code.</summary>
    /// <param name="ticket">The pending-login ticket from its cookie; null or empty when the cookie is missing.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The wait before the next resend, a 429 for the cooldown or the cap, or a 401 when the pending sign-in is gone.</returns>
    public async Task<Result<ResendCodeOutcome>> HandleAsync(string? ticket, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(ticket))
        {
            return Result.Failure<ResendCodeOutcome>(AuthErrors.TicketExpired);
        }

        var challenge = await challenges.FindByTicketHashAsync(TokenHash.Compute(ticket), cancellationToken).ConfigureAwait(false);
        if (challenge is null)
        {
            return Result.Failure<ResendCodeOutcome>(AuthErrors.TicketExpired);
        }

        var now = time.GetUtcNow();
        var user = await accounts.FindByIdAsync(challenge.UserId, cancellationToken).ConfigureAwait(false);
        if (user is null || !user.IsActive || (user.LockoutEnd is { } lockedUntil && lockedUntil > now))
        {
            return Result.Failure<ResendCodeOutcome>(AuthErrors.TicketExpired);
        }

        var twoFactor = settings.ToTwoFactorSettings();
        var sent = await challenges.CountCodesIssuedSinceAsync(user.Id, now - twoFactor.SendWindow, cancellationToken).ConfigureAwait(false);
        var decision = challenge.CheckResend(now, sent, twoFactor);
        return decision.Kind switch
        {
            ResendDecisionKind.Allowed => Result.Success(await SendAsync(challenge, user, now, twoFactor, cancellationToken).ConfigureAwait(false)),
            ResendDecisionKind.CoolingDown => Result.Failure<ResendCodeOutcome>(AuthErrors.ResendCooldown(decision.RetryAfter!.Value)),
            ResendDecisionKind.CapReached => Result.Failure<ResendCodeOutcome>(AuthErrors.ResendCap),
            _ => Result.Failure<ResendCodeOutcome>(AuthErrors.TicketExpired),
        };
    }

    // The new code supersedes the old one in the same save that queues its email.
    private async Task<ResendCodeOutcome> SendAsync(
        TwoFactorChallenge challenge, UserAccount user, DateTimeOffset now, TwoFactorSettings twoFactor, CancellationToken cancellationToken)
    {
        var code = random.NewSixDigitCode();
        var issued = challenge.IssueCode(codeMac.Compute(challenge.Id, user.Id, code), now, twoFactor);
        await outbox.EnqueueAsync(
            new SignInCodeEmail(user.Email, code, issued.ExpiresAt, now, DeviceSummary.Describe(requestContext.UserAgent)),
            cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.TwoFactorResent, "User", user.Id.ToString("D", CultureInfo.InvariantCulture), null);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return new ResendCodeOutcome((int)settings.ResendCooldown.TotalSeconds);
    }
}
