using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Users;

/// <summary>
/// Use case: a Manager emails a colleague a password reset link that the colleague opens themself (USER-07). The link lasts 30
/// minutes and works once, names the Manager, replaces any open reset link and counts toward the same hourly cap as forgot-password
/// (D-39). Only an active person who has a password gets one: a deactivated or Manager-locked person is refused (<c>users.blocked</c>,
/// D-41 Q5) and a person who never set a password is pointed to the invitation (<c>users.no-password</c>). A person whose address no correct sign-in code has proved yet gets nothing and the
/// same success answer (D-49), so a mistyped address never receives a link. The link travels only by
/// email; nothing returned to the Manager holds it. No version is sent: the action acts on the latest state and does not change the
/// account itself (D-21). The account lock makes two requests run one after the other, so the cap is counted after the first committed.
/// </summary>
public sealed class SendResetLinkHandler(
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
    private const string UserTarget = "User";

    /// <summary>Emails the reset link.</summary>
    /// <param name="id">The account the link is for.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 401 when the token names no user, a 404 when the person does not exist or was deleted, a 409 when two saves lost a race, a 422 when the person is blocked or has no password, or a 429 when the hourly cap is reached.</returns>
    public async Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is not { } callerId
            || await directory.GetProfileAsync(callerId, cancellationToken).ConfigureAwait(false) is not { } manager)
        {
            return Result.Failure(AuthErrors.SessionEnded);
        }

        var managerName = $"{manager.FirstName} {manager.LastName}";
        return await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => SendAsync(id, managerName, token), cancellationToken),
                Result.Failure(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
    }

    private async Task<Result> SendAsync(Guid id, string managerName, CancellationToken cancellationToken)
    {
        await tokens.LockAccountAsync(id, cancellationToken).ConfigureAwait(false);

        var target = await accounts.FindByIdAsync(id, cancellationToken).ConfigureAwait(false);
        if (target is null || target.IsDeleted)
        {
            return Result.Failure(UserErrors.NotFound);
        }

        if (target.IsBlocked)
        {
            return Result.Failure(UserErrors.Blocked);
        }

        if (!target.HasPassword)
        {
            return Result.Failure(UserErrors.NoPassword);
        }

        // D-49: no code has proved this address yet, so no link goes to it; the answer stays the same success.
        if (!target.EmailConfirmed)
        {
            return Result.Success();
        }

        var now = time.GetUtcNow();
        if (await ResetEmailCap.IsReachedAsync(outbox, target.Email, now, settings, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(UserErrors.ResetLinkCapped);
        }

        await tokens.RevokeOpenAsync(id, AccountTokenPurpose.PasswordReset, now, cancellationToken).ConfigureAwait(false);

        var secret = random.NewToken();
        var created = AccountToken.Create(id, AccountTokenPurpose.PasswordReset, TokenHash.Compute(secret), now, settings.ResetLinkLifetime);
        tokens.Add(created);
        await outbox.EnqueueAsync(new ManagerResetLinkEmail(target.Email, secret, created.ExpiresAt, now, managerName), cancellationToken).ConfigureAwait(false);

        audit.Record(AuditActions.UserResetLinkSent, UserTarget, AuditKey.Of(id), null);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }
}
