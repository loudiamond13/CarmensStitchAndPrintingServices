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
    IPwnedPasswords pwned,
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
            failure = account is null ? AuditActions.DetailUnknownAccount : AuditActions.DetailNoPassword;
        }
        else
        {
            // The real hash is checked for every account state; a blocked account is never counted.
            var check = await accounts.CheckPasswordAsync(account.Id, password, cancellationToken).ConfigureAwait(false);
            if (account.IsBlocked)
            {
                failure = account.IsDeleted ? AuditActions.DetailDeleted : account.IsManagerLocked ? AuditActions.DetailManagerLocked : AuditActions.DetailDeactivated;
            }
            else if (!account.EmailConfirmed)
            {
                failure = AuditActions.DetailUnconfirmed;
            }
            else if (IsLocked(account))
            {
                failure = AuditActions.DetailLocked;
            }
            else if (check == PasswordCheck.Failed)
            {
                await CountFailureAsync(account, cancellationToken).ConfigureAwait(false);
                failure = AuditActions.DetailBadPassword;
            }
            else
            {
                if (account.BreachRecheckPending)
                {
                    await RecheckBreachAsync(account, password, cancellationToken).ConfigureAwait(false);
                }

                // Two logins at once race on the open challenge; the loser tries once more, then answers like a wrong password.
                outcome = await ConflictRetry.RunAsync<SignInOutcome?>(
                    async () => await StartChallengeAsync(account, request.KeepSignedIn, cancellationToken).ConfigureAwait(false),
                    null).ConfigureAwait(false);
            }
        }

        if (failure is not null)
        {
            await audit.RecordIndependentlyAsync(AuditActions.SignInFailed, account is null ? null : UserTarget, account is null ? null : AuditKey.Of(account.Id), failure, cancellationToken).ConfigureAwait(false);
        }

        await ResponseFloor.WaitAsync(started, settings.ResponseFloor, time, cancellationToken).ConfigureAwait(false);
        return outcome is null
            ? Result.Failure<SignInOutcome>(AuthErrors.InvalidCredentials)
            : Result.Success(outcome);
    }


    private bool IsLocked(UserAccount account) => account.LockoutEnd is { } end && end > time.GetUtcNow();

    // The count, and when it locks the account the one lockout email and its audit entry, commit together (T-04-39).
    private async Task CountFailureAsync(UserAccount account, CancellationToken cancellationToken) =>
        await unitOfWork.InTransactionAsync(
            async token =>
            {
                var result = await accounts.RecordFailedPasswordAsync(account.Id, token).ConfigureAwait(false);
                if (result.LockedNow)
                {
                    // LockoutEnd is always set when LockedNow is true (IUserAccounts contract).
                    await outbox.EnqueueAsync(new AccountLockedEmail(account.Email, result.LockoutEnd!.Value, LockoutCause.Password, settings.PasswordLockoutDuration), token).ConfigureAwait(false);
                    audit.Record(AuditActions.Lockout, UserTarget, AuditKey.Of(account.Id), AuditActions.DetailPassword);
                    await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                }

                // InTransactionAsync<T> needs a result; nobody reads this one.
                return true;
            },
            cancellationToken).ConfigureAwait(false);

    // D-18: a password accepted while the breach service was down is checked again now. It runs only after the correct
    // password, so sign-in timing for everyone else is unchanged (CWE-204). A breach sends the account to the
    // set-new-password step after the code; an outage leaves the mark pending; sign-in continues in every case.
    private async Task RecheckBreachAsync(UserAccount account, string password, CancellationToken cancellationToken)
    {
        var answer = await pwned.CheckAsync(PasswordPolicy.Normalize(password), cancellationToken).ConfigureAwait(false);
        if (answer == BreachCheckResult.Unavailable)
        {
            return;
        }

        var breached = answer == BreachCheckResult.Breached;
        await unitOfWork.InTransactionAsync(
            async token =>
            {
                if (breached)
                {
                    await accounts.SetMustChangePasswordAsync(account.Id, PasswordChangeReason.Breach, token).ConfigureAwait(false);
                }

                await accounts.ClearBreachRecheckAsync(account.Id, token).ConfigureAwait(false);
                if (breached)
                {
                    audit.Record(AuditActions.PasswordBreachFound, UserTarget, AuditKey.Of(account.Id), null);
                }

                // Saved on both branches, so the clean branch does not rely on UserManager saving the shared context.
                await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                return true;
            },
            cancellationToken).ConfigureAwait(false);
    }

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
                audit.Record(AuditActions.TwoFactorIssued, UserTarget, AuditKey.Of(account.Id), null);
                await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);

                return new SignInOutcome(ticket, challenge.ExpiresAt, (int)settings.ResendCooldown.TotalSeconds);
            },
            cancellationToken).ConfigureAwait(false);
    }
}
