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
/// Use case: ask for a password reset link by email (AUTH-08, D-16). The answer and its timing are the same for every
/// address, so nothing says whether an account exists (CWE-204, D-39). An active account gets a link, a deactivated one
/// a notice without a link (D-20), a Manager-locked one nothing (D-41), and an unknown or deleted address nothing. At most 3 emails per account per hour go out (D-39), and a
/// new link revokes the earlier ones, so one link works at a time.
/// </summary>
public sealed class ForgotPasswordHandler(
    IUserAccounts accounts,
    IAccountTokens tokens,
    ISecureRandom random,
    IEmailOutbox outbox,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<ForgotPasswordRequest> validator,
    AuthSettings settings,
    TimeProvider time)
{
    private const string UserTarget = "User";
    private static readonly TimeSpan CapWindow = TimeSpan.FromHours(1);

    /// <summary>Handles one request.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success for any well-formed email, or a 400 for a missing or malformed one.</returns>
    public async Task<Result> HandleAsync(ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure(ValidationResults.ToError(validation, AuthErrors.ValidationCode, AuthErrors.ValidationMessage));
        }

        var started = time.GetTimestamp();
        var account = await accounts.FindByEmailAsync(request.Email!.Trim(), cancellationToken).ConfigureAwait(false);

        // A lost race that repeats still answers success: the other request saved a link or a notice for this address.
        await ConflictRetry.RunAsync(() => AnswerAsync(account, cancellationToken), true).ConfigureAwait(false);

        await ResponseFloor.WaitAsync(started, settings.ResponseFloor, time, cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    private static string Key(Guid id) => id.ToString("D", CultureInfo.InvariantCulture);

    // An account that cannot sign in yet (invited, email unconfirmed) or is deleted is answered like an unknown address.
    // A Manager lock is checked before the deactivated notice, so a locked account never learns anything by email (D-41 Q5).
    private Task<bool> AnswerAsync(UserAccount? account, CancellationToken cancellationToken) =>
        unitOfWork.InTransactionAsync(
            async token =>
            {
                if (account is null || account.IsDeleted || (account.IsActive && !account.EmailConfirmed))
                {
                    audit.Record(AuditActions.PasswordResetRequested, null, null, "unknown-account");
                }
                else if (account.IsManagerLocked)
                {
                    audit.Record(AuditActions.PasswordResetRequested, UserTarget, Key(account.Id), "manager-locked");
                }
                else if (account.IsActive)
                {
                    await SendLinkAsync(account, token).ConfigureAwait(false);
                }
                else
                {
                    await SendNoticeAsync(account, token).ConfigureAwait(false);
                }

                await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                return true;
            },
            cancellationToken);

    // The account lock makes two requests for the same account run one after the other: the cap is counted after
    // the first one committed, and the second revokes the first one's link.
    private async Task SendLinkAsync(UserAccount account, CancellationToken cancellationToken)
    {
        await tokens.LockAccountAsync(account.Id, cancellationToken).ConfigureAwait(false);

        var now = time.GetUtcNow();
        // A Manager's reset link counts toward the same hourly cap (USER-07).
        if (await ResetEmailCap.IsReachedAsync(outbox, account.Email, now, settings, cancellationToken).ConfigureAwait(false))
        {
            audit.Record(AuditActions.PasswordResetRequested, UserTarget, Key(account.Id), "capped");
            return;
        }

        await tokens.RevokeOpenAsync(account.Id, AccountTokenPurpose.PasswordReset, now, cancellationToken).ConfigureAwait(false);

        var secret = random.NewToken();
        var created = AccountToken.Create(account.Id, AccountTokenPurpose.PasswordReset, TokenHash.Compute(secret), now, settings.ResetLinkLifetime);
        tokens.Add(created);

        await outbox.EnqueueAsync(
            new PasswordResetEmail(account.Email, secret, created.ExpiresAt, now, DeviceSummary.Describe(requestContext.UserAgent)),
            cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.PasswordResetRequested, UserTarget, Key(account.Id), "sent");
    }

    private async Task SendNoticeAsync(UserAccount account, CancellationToken cancellationToken)
    {
        if (await IsCappedAsync(AuthEmailKind.DeactivatedNotice, account.Email, time.GetUtcNow(), cancellationToken).ConfigureAwait(false))
        {
            audit.Record(AuditActions.PasswordResetRequested, UserTarget, Key(account.Id), "capped");
            return;
        }

        await outbox.EnqueueAsync(new DeactivatedNoticeEmail(account.Email), cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.PasswordResetRequested, UserTarget, Key(account.Id), "deactivated");
    }

    private async Task<bool> IsCappedAsync(AuthEmailKind kind, string toAddress, DateTimeOffset now, CancellationToken cancellationToken) =>
        await outbox.CountRecentAsync(kind, toAddress, now - CapWindow, cancellationToken).ConfigureAwait(false) >= settings.ResetEmailsPerHour;
}
