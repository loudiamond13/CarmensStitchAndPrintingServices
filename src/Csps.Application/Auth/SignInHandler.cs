using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using FluentValidation;

namespace Csps.Application.Auth;

/// <summary>What a successful first sign-in step hands back to the controller.</summary>
/// <param name="Ticket">The pending-login ticket for the cookie. A secret.</param>
/// <param name="TicketExpiresAt">When the ticket stops working.</param>
/// <param name="ResendAfterSeconds">How long the page waits before offering a new code.</param>
public sealed record SignInOutcome(string Ticket, DateTimeOffset TicketExpiresAt, int ResendAfterSeconds)
{
    /// <summary>Returns the type name only, so the ticket never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(SignInOutcome);
}

/// <summary>
/// Use case: the email and password step of staff sign-in (AUTH-01, AUTH-02, AUTH-07, AUTH-10). Every branch checks
/// exactly one password hash and takes at least the response floor, and every failure is the same 401, so neither the
/// answer nor its timing says whether an account exists (CWE-203, CWE-204, D-02, D-39).
/// </summary>
public sealed class SignInHandler(
    IUserAccounts accounts,
    ITwoFactorChallenges challenges,
    ICodeMac codeMac,
    ISecureRandom random,
    IEmailOutbox outbox,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<SignInRequest> validator,
    AuthSettings settings,
    TimeProvider time)
{
    private const string UserTarget = "User";

    /// <summary>Runs the first sign-in step.</summary>
    /// <param name="request">The sign-in form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The ticket on success, a 400 for a bad form, or the one generic 401.</returns>
    public async Task<Result<SignInOutcome>> HandleAsync(SignInRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<SignInOutcome>(ValidationResults.ToError(validation, AuthErrors.ValidationCode, AuthErrors.ValidationMessage));
        }

        var started = time.GetTimestamp();
        var password = request.Password!;
        var account = await accounts.FindByEmailAsync(request.Email!.Trim(), cancellationToken).ConfigureAwait(false);

        SignInOutcome? outcome = null;
        string? failure = null;
        if (account is null || !account.HasPassword)
        {
            // Same hashing work as a real check, so a missing account or password costs the same time.
            accounts.VerifyDummyPassword(password);
            failure = account is null ? "unknown-account" : "no-password";
        }
        else
        {
            // The real hash is checked for every account state; a blocked account is never counted.
            var check = await accounts.CheckPasswordAsync(account.Id, password, cancellationToken).ConfigureAwait(false);
            if (!account.IsActive)
            {
                failure = "deactivated";
            }
            else if (!account.EmailConfirmed)
            {
                failure = "unconfirmed";
            }
            else if (IsLocked(account))
            {
                failure = "locked";
            }
            else if (check == PasswordCheck.Failed)
            {
                await accounts.RecordFailedPasswordAsync(account.Id, cancellationToken).ConfigureAwait(false);
                failure = "bad-password";
            }
            else
            {
                outcome = await StartChallengeAsync(account, request.KeepSignedIn, cancellationToken).ConfigureAwait(false);
            }
        }

        if (failure is not null)
        {
            await audit.RecordIndependentlyAsync(AuditActions.SignInFailed, account is null ? null : UserTarget, account is null ? null : Key(account.Id), null, cancellationToken).ConfigureAwait(false);
        }

        await ResponseFloor.WaitAsync(started, settings.ResponseFloor, time, cancellationToken).ConfigureAwait(false);
        return outcome is null
            ? Result.Failure<SignInOutcome>(AuthErrors.InvalidCredentials)
            : Result.Success(outcome);
    }

    private static string Key(Guid id) => id.ToString("D", CultureInfo.InvariantCulture);

    private bool IsLocked(UserAccount account) => account.LockoutEnd is { } end && end > time.GetUtcNow();

    // Identity changes first (Pitfall 13): UserManager saves the shared context, so the tracked challenge, email and
    // audit rows are added only after it, and one SaveChanges commits them together.
    private async Task<SignInOutcome> StartChallengeAsync(UserAccount account, bool keepSignedIn, CancellationToken cancellationToken)
    {
        var twoFactor = settings.ToTwoFactorSettings();
        return await unitOfWork.InTransactionAsync(
            async token =>
            {
                await accounts.ResetFailedCountAsync(account.Id, token).ConfigureAwait(false);

                var now = time.GetUtcNow();
                await challenges.InvalidateOpenAsync(account.Id, now, token).ConfigureAwait(false);

                var ticket = random.NewToken();
                var challenge = TwoFactorChallenge.Start(account.Id, TokenHash.Compute(ticket), keepSignedIn, now, twoFactor);
                var code = random.NewSixDigitCode();
                var issued = challenge.IssueCode(codeMac.Compute(challenge.Id, account.Id, code), now, twoFactor);
                challenges.Add(challenge);

                await outbox.EnqueueAsync(
                    new SignInCodeEmail(account.Email, code, issued.ExpiresAt, now, DeviceSummary.Describe(requestContext.UserAgent)),
                    token).ConfigureAwait(false);
                audit.Record(AuditActions.TwoFactorIssued, UserTarget, Key(account.Id), null);
                await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);

                return new SignInOutcome(ticket, challenge.ExpiresAt, (int)settings.ResendCooldown.TotalSeconds);
            },
            cancellationToken).ConfigureAwait(false);
    }
}
