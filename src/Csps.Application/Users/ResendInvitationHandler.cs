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
/// Use case: a Manager sends a fresh invitation to a person who has not set a password yet (USER-07, D-13). The open invitation is
/// revoked, so the old link stops working, and a new 7-day single-use link is emailed to the person with the Manager's name in the first
/// line. The link travels only by email; nothing returned to the Manager holds it. A person who already has a password is refused
/// (<c>users.already-set-up</c>), and so is anyone deactivated or locked (<c>users.blocked</c>). No version is sent: the action acts on
/// the latest state and does not change the account itself (D-21). The account lock makes two requests run one after the other, so only
/// one link is ever open.
/// </summary>
public sealed class ResendInvitationHandler(
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

    /// <summary>Sends the invitation again.</summary>
    /// <param name="id">The invited account.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 401 when the token names no user, a 404 when the person does not exist or was deleted, a 409 when two saves lost a race, or a 422 when the person is blocked or already set up.</returns>
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

        if (target.HasPassword)
        {
            return Result.Failure(UserErrors.AlreadySetUp);
        }

        var now = time.GetUtcNow();
        await tokens.RevokeOpenAsync(id, AccountTokenPurpose.Invitation, now, cancellationToken).ConfigureAwait(false);

        var secret = random.NewToken();
        var invitation = AccountToken.Create(id, AccountTokenPurpose.Invitation, TokenHash.Compute(secret), now, settings.InviteLinkLifetime);
        tokens.Add(invitation);
        await outbox.EnqueueAsync(new InviteEmail(target.Email, secret, invitation.ExpiresAt, now, managerName), cancellationToken).ConfigureAwait(false);

        audit.Record(AuditActions.UserInvitationResent, UserTarget, AuditKey.Of(id), null);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }
}
