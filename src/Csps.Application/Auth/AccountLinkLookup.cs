using Csps.Application.Ports;
using Csps.Domain.Identity;

namespace Csps.Application.Auth;

/// <summary>A usable invite or reset link: the tracked token and the account it belongs to.</summary>
/// <param name="Token">The tracked token.</param>
/// <param name="Account">The account.</param>
internal sealed record AccountLink(AccountToken Token, UserAccount Account);

/// <summary>Finds the usable invite or reset link for a presented token; every kind of failure gives the same null.</summary>
internal static class AccountLinkLookup
{
    private const int TokenLength = 43;

    /// <summary>Looks a token up.</summary>
    /// <param name="token">The presented token.</param>
    /// <param name="purpose">The kind of link: <see cref="AccountTokenPurpose.Invitation"/> or <see cref="AccountTokenPurpose.PasswordReset"/>.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="tokens">The token store.</param>
    /// <param name="accounts">The accounts.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>The link, or null for a malformed, unknown, used, revoked or expired token or an account that may not use it.</returns>
    public static async Task<AccountLink?> FindAsync(
        string? token, AccountTokenPurpose purpose, DateTimeOffset now, IAccountTokens tokens, IUserAccounts accounts, CancellationToken cancellationToken)
    {
        if (!IsWellFormed(token))
        {
            return null;
        }

        var stored = await tokens.FindByHashAsync(TokenHash.Compute(token!), purpose, cancellationToken).ConfigureAwait(false);
        if (stored is null || !stored.IsUsable(now))
        {
            return null;
        }

        var account = await accounts.FindByIdAsync(stored.UserId, cancellationToken).ConfigureAwait(false);
        return account is not null && MayUse(account, purpose) ? new AccountLink(stored, account) : null;
    }

    // 32 random bytes in base64url without padding.
    internal static bool IsWellFormed(string? token) =>
        token is { Length: TokenLength } && token.All(static c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_');

    // A blocked (deactivated, Manager-locked or deleted) account is always refused. An invited account is not confirmed yet,
    // but a reset never turns an unconfirmed one into an active one (AUTH-10, D-17, D-19).
    private static bool MayUse(UserAccount account, AccountTokenPurpose purpose) =>
        !account.IsBlocked && (purpose != AccountTokenPurpose.PasswordReset || account.EmailConfirmed);
}
