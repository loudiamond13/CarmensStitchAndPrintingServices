using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Profile;

/// <summary>
/// Use case: the caller asks for a fresh confirmation link while an email change is waiting (PROF-02, D-24). One transaction,
/// under the per-account link lock, revokes the open link, issues a new 24-hour single-use one and queues it to the pending
/// address only; the current address gets nothing. The target is always the token's user (CWE-639), and no address or token
/// reaches a log or the audit trail (T-05-40).
/// </summary>
public sealed class ResendEmailChangeHandler(
    IUserAccounts accounts,
    IUserDirectory directory,
    IAccountTokens tokens,
    ISecureRandom random,
    IEmailOutbox outbox,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    AuthSettings settings,
    TimeProvider time)
{
    /// <summary>The audit detail that tells a resend from the first request.</summary>
    public const string ResentDetail = "resent";

    private const string UserTarget = "User";

    /// <summary>Sends the fresh link.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 401 when the token names no usable account, a 404 when nothing is waiting, or a 409 when two saves lost a race.</returns>
    public async Task<Result> HandleAsync(CancellationToken cancellationToken)
    {
        if (requestContext.UserId is not { } userId)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        var account = await accounts.FindByIdAsync(userId, cancellationToken).ConfigureAwait(false);
        if (account is null || account.IsBlocked)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        return await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => ResendAsync(account.Id, token), cancellationToken),
                Result.Failure(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
    }

    private async Task<Result> ResendAsync(Guid userId, CancellationToken cancellationToken)
    {
        // The lock makes a resend and a cancel or a new request run one after the other, so only the newest link lives.
        await tokens.LockAccountAsync(userId, cancellationToken).ConfigureAwait(false);

        var profile = await directory.GetProfileAsync(userId, cancellationToken).ConfigureAwait(false);
        if (profile?.PendingEmail is not { Length: > 0 } pending)
        {
            return Result.Failure(EmailChangeErrors.None);
        }

        var now = time.GetUtcNow();
        await tokens.RevokeOpenAsync(userId, AccountTokenPurpose.EmailChange, now, cancellationToken).ConfigureAwait(false);

        var secret = random.NewToken();
        var created = AccountToken.Create(userId, AccountTokenPurpose.EmailChange, TokenHash.Compute(secret), now, settings.EmailChangeLinkLifetime);
        tokens.Add(created);

        await outbox.EnqueueAsync(new EmailChangeConfirmEmail(pending, secret, created.ExpiresAt, now, profile.Email), cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.ProfileEmailChangeRequested, UserTarget, AuditKey.Of(userId), ResentDetail);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }
}
