using System.Buffers.Text;
using Csps.Application.Ports;
using Csps.Domain.Identity;

namespace Csps.Application.Auth;

/// <summary>A usable reset link: the tracked token and the active account it belongs to.</summary>
/// <param name="Token">The tracked token.</param>
/// <param name="Account">The account.</param>
internal sealed record ResetLink(AccountToken Token, UserAccount Account);

/// <summary>Finds the usable reset link for a presented token; every kind of failure gives the same null.</summary>
internal static class ResetLinkLookup
{
    private const int TokenLength = 43;

    /// <summary>Looks a token up.</summary>
    /// <param name="token">The presented token.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="tokens">The token store.</param>
    /// <param name="accounts">The accounts.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>The link, or null for a malformed, unknown, used, revoked, expired token or an account that may not sign in.</returns>
    public static async Task<ResetLink?> FindAsync(
        string? token, DateTimeOffset now, IAccountTokens tokens, IUserAccounts accounts, CancellationToken cancellationToken)
    {
        if (!IsWellFormed(token))
        {
            return null;
        }

        var stored = await tokens.FindByHashAsync(TokenHash.Compute(token!), AccountTokenPurpose.PasswordReset, cancellationToken).ConfigureAwait(false);
        if (stored is null || !stored.IsUsable(now))
        {
            return null;
        }

        // A deactivated or unconfirmed account never resets into an active one (AUTH-10, D-19).
        var account = await accounts.FindByIdAsync(stored.UserId, cancellationToken).ConfigureAwait(false);
        return account is { IsActive: true, EmailConfirmed: true } ? new ResetLink(stored, account) : null;
    }

    // 32 random bytes in base64url without padding.
    private static bool IsWellFormed(string? token) =>
        token is { Length: TokenLength } && Base64Url.IsValid(token);
}
