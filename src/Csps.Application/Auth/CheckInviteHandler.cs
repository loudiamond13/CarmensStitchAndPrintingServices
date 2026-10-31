using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Auth;

/// <summary>
/// Use case: tell the accept-invite page whether its link still works and whose account it is for (D-29). A malformed,
/// unknown, used, revoked or expired token and a deactivated account all get the same answer (CWE-640).
/// </summary>
public sealed class CheckInviteHandler(IAccountTokens tokens, IUserAccounts accounts, TimeProvider time)
{
    /// <summary>Checks one invite.</summary>
    /// <param name="request">The token.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The account email and names, or a 404 for any invite that does not work.</returns>
    public async Task<Result<InviteLinkResponse>> HandleAsync(InviteTokenRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var invite = await AccountLinkLookup.FindAsync(request.Token, AccountTokenPurpose.Invitation, time.GetUtcNow(), tokens, accounts, cancellationToken).ConfigureAwait(false);
        return invite is null
            ? Result.Failure<InviteLinkResponse>(AuthErrors.InviteInvalid)
            : Result.Success(new InviteLinkResponse(invite.Account.Email, invite.Account.FirstName, invite.Account.LastName));
    }
}
