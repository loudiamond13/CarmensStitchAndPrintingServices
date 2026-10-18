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
/// Use case: the caller asks to change their sign-in email (PROF-02, C-9, D-24, D-25). The current password must match, by
/// the same rule and lockout count as a password change (D-41 Q9), and only then is the address checked against other accounts,
/// so a taken address is never shown to someone who does not know the password. One transaction, under the per-account link
/// lock, replaces any older request: it revokes open email-change links, stores the new address as pending, queues a 24-hour single-use link to the new address and a notice to the current
/// one, and audits the request by user id only. The sign-in email does not change until the new address confirms.
/// The target is always the token's user (CWE-639), and no address, password or token reaches a log or the audit trail.
/// </summary>
public sealed class RequestEmailChangeHandler(
    IUserAccounts accounts,
    IUserDirectory directory,
    IAccountTokens tokens,
    ISecureRandom random,
    IEmailOutbox outbox,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<RequestEmailChangeRequest> validator,
    CurrentPasswordCheck passwordCheck,
    AuthSettings settings,
    TimeProvider time)
{
    private const string UserTarget = "User";

    /// <summary>Starts the change.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The profile with the pending address, a 400 on the field that failed, a 401 when the token names no usable account, a 409 when two saves lost a race, or a 429 while the account is locked.</returns>
    public async Task<Result<ProfileResponse>> HandleAsync(RequestEmailChangeRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is not { } userId)
        {
            return Result.Failure<ProfileResponse>(AuthErrors.SessionEnded);
        }

        var account = await accounts.FindByIdAsync(userId, cancellationToken).ConfigureAwait(false);
        if (account is null || account.IsBlocked)
        {
            return Result.Failure<ProfileResponse>(AuthErrors.SessionEnded);
        }

        // The context carries the current email so the validator can refuse the caller's own address.
        var context = new ValidationContext<RequestEmailChangeRequest>(request);
        context.RootContextData[RequestEmailChangeRequestValidator.CurrentEmailKey] = account.Email;
        var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<ProfileResponse>(ValidationResults.ToError(validation, AuthErrors.ValidationCode, AuthErrors.ValidationMessage));
        }

        var proof = await passwordCheck.CheckAsync(account, request.CurrentPassword!, cancellationToken).ConfigureAwait(false);
        if (proof.IsFailure)
        {
            return Result.Failure<ProfileResponse>(proof.Error);
        }

        var newEmail = request.NewEmail!.Trim();
        if (await accounts.FindByEmailAsync(newEmail, cancellationToken).ConfigureAwait(false) is { IsDeleted: false })
        {
            return Result.Failure<ProfileResponse>(EmailChangeErrors.AddressTaken);
        }

        var done = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => StartAsync(account, newEmail, token), cancellationToken),
                false)
            .ConfigureAwait(false);
        if (!done)
        {
            return Result.Failure<ProfileResponse>(AuthErrors.SessionBusy);
        }

        var view = await directory.GetProfileAsync(account.Id, cancellationToken).ConfigureAwait(false);
        return view is null
            ? Result.Failure<ProfileResponse>(AuthErrors.SessionEnded)
            : Result.Success(ProfileResponse.From(view));
    }

    private async Task<bool> StartAsync(UserAccount account, string newEmail, CancellationToken cancellationToken)
    {
        // The lock makes two requests for the same account run one after the other, so the later one revokes the earlier link.
        await tokens.LockAccountAsync(account.Id, cancellationToken).ConfigureAwait(false);

        // The right password clears the wrong-password count, as a password change does. Identity saves on its own, so it goes first.
        await accounts.ResetFailedCountAsync(account.Id, cancellationToken).ConfigureAwait(false);

        var now = time.GetUtcNow();
        await tokens.RevokeOpenAsync(account.Id, AccountTokenPurpose.EmailChange, now, cancellationToken).ConfigureAwait(false);

        // Identity saves on the shared context, so the pending address goes first and the token, mail and audit follow together.
        await accounts.SetPendingEmailAsync(account.Id, newEmail, cancellationToken).ConfigureAwait(false);

        var secret = random.NewToken();
        var created = AccountToken.Create(account.Id, AccountTokenPurpose.EmailChange, TokenHash.Compute(secret), now, settings.EmailChangeLinkLifetime);
        tokens.Add(created);

        await outbox.EnqueueAsync(new EmailChangeConfirmEmail(newEmail, secret, created.ExpiresAt, now, account.Email), cancellationToken).ConfigureAwait(false);
        await outbox.EnqueueAsync(
            new EmailChangeNoticeEmail(account.Email, newEmail, now, DeviceSummary.Describe(requestContext.UserAgent)),
            cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.ProfileEmailChangeRequested, UserTarget, AuditKey.Of(account.Id), null);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return true;
    }
}
