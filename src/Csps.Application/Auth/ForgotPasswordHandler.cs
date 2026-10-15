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
/// address, so nothing says whether an account exists (CWE-204, D-39). A new request revokes the account's earlier
/// links, so one link works at a time.
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
        if (account is { IsActive: true, EmailConfirmed: true })
        {
            await ConflictRetry.RunAsync(() => SendLinkAsync(account, cancellationToken), true).ConfigureAwait(false);
        }

        await ResponseFloor.WaitAsync(started, settings.ResponseFloor, time, cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    private static string Key(Guid id) => id.ToString("D", CultureInfo.InvariantCulture);

    // The old links' revocation, the new token, the email and the audit entry commit together.
    private Task<bool> SendLinkAsync(UserAccount account, CancellationToken cancellationToken) =>
        unitOfWork.InTransactionAsync(
            async token =>
            {
                var now = time.GetUtcNow();
                await tokens.RevokeOpenAsync(account.Id, AccountTokenPurpose.PasswordReset, now, token).ConfigureAwait(false);

                var secret = random.NewToken();
                var created = AccountToken.Create(account.Id, AccountTokenPurpose.PasswordReset, TokenHash.Compute(secret), now, settings.ResetLinkLifetime);
                tokens.Add(created);

                await outbox.EnqueueAsync(
                    new PasswordResetEmail(account.Email, secret, created.ExpiresAt, now, DeviceSummary.Describe(requestContext.UserAgent)),
                    token).ConfigureAwait(false);
                audit.Record(AuditActions.PasswordResetRequested, UserTarget, Key(account.Id), "sent");
                await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                return true;
            },
            cancellationToken);
}
