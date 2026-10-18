using Csps.Application.Ports;
using Csps.Domain.Identity;

namespace Csps.Application.Auth;

/// <summary>A usable invite: the tracked token and the active account it belongs to.</summary>
/// <param name="Token">The tracked token.</param>
/// <param name="Account">The account.</param>
internal sealed record InviteLink(AccountToken Token, UserAccount Account);

/// <summary>Finds the usable invite for a presented token; every kind of failure gives the same null.</summary>
internal static class InviteLinkLookup
{
    /// <summary>Looks a token up.</summary>
    /// <param name="token">The presented token.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="tokens">The token store.</param>
    /// <param name="accounts">The accounts.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>The invite, or null for a malformed, unknown, used, revoked or expired token or a blocked account.</returns>
    public static async Task<InviteLink?> FindAsync(
        string? token, DateTimeOffset now, IAccountTokens tokens, IUserAccounts accounts, CancellationToken cancellationToken)
    {
        if (!ResetLinkLookup.IsWellFormed(token))
        {
            return null;
        }

        var stored = await tokens.FindByHashAsync(TokenHash.Compute(token!), AccountTokenPurpose.Invitation, cancellationToken).ConfigureAwait(false);
        if (stored is null || !stored.IsUsable(now))
        {
            return null;
        }

        // An invited account is not confirmed yet; only a blocked one (deactivated, Manager-locked or deleted) is refused.
        var account = await accounts.FindByIdAsync(stored.UserId, cancellationToken).ConfigureAwait(false);
        return account is { IsBlocked: false } ? new InviteLink(stored, account) : null;
    }
}
