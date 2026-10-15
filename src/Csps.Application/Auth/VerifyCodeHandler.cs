using System.Globalization;
using Csps.Application.Common;
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
        if (user is null || !user.IsActive)
        {
            return Result.Failure<VerifyCodeOutcome>(AuthErrors.TicketExpired);
        }

        var now = time.GetUtcNow();
        var twoFactor = settings.ToTwoFactorSettings();
        var mac = codeMac.Compute(challenge.Id, user.Id, request.Code!);
        var result = challenge.Verify(mac, now, twoFactor);
        if (result.Outcome != TwoFactorVerifyOutcome.Ok || user.MustChangePassword is not null)
        {
            return Result.Failure<VerifyCodeOutcome>(AuthErrors.TicketExpired);
        }

        return Result.Success(await SignInAsync(challenge, user, cancellationToken).ConfigureAwait(false));
    }

    private static string Key(Guid id) => id.ToString("D", CultureInfo.InvariantCulture);

    private async Task<VerifyCodeOutcome> SignInAsync(TwoFactorChallenge challenge, UserAccount user, CancellationToken cancellationToken)
    {
        challenge.Complete(time.GetUtcNow());
        var issued = await sessionIssuer.StartAsync(user, challenge.Persistent, cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.TwoFactorVerified, UserTarget, Key(user.Id), null);
        audit.Record(AuditActions.SignedIn, SessionTarget, Key(issued.SessionId), null);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return new VerifyCodeOutcome(VerifyNext.SignedIn, null, issued);
    }
}
