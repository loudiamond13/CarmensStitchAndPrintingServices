using Csps.Application.Ports;
using Csps.Domain.Identity;

namespace Csps.Application.Auth;

/// <summary>A pending sign-in that may still set a new password: the tracked challenge and its account.</summary>
/// <param name="Challenge">The tracked challenge.</param>
/// <param name="Account">The account that may still sign in.</param>
internal sealed record PendingPasswordChange(TwoFactorChallenge Challenge, UserAccount Account);

/// <summary>Finds the pending sign-in that may set a new password; every kind of failure gives the same null.</summary>
internal static class PendingPasswordChangeLookup
{
    /// <summary>Looks a ticket up.</summary>
    /// <param name="ticket">The ticket from the pending-login cookie; null or empty when the cookie is missing.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="challenges">The challenge store.</param>
    /// <param name="accounts">The accounts.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>The pending change, or null for a missing, unknown, unverified, spent or expired ticket or an account that may not sign in.</returns>
    public static async Task<PendingPasswordChange?> FindAsync(
        string? ticket, DateTimeOffset now, ITwoFactorChallenges challenges, IUserAccounts accounts, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(ticket))
        {
            return null;
        }

        var challenge = await challenges.FindByTicketHashAsync(TokenHash.Compute(ticket), cancellationToken).ConfigureAwait(false);
        if (challenge is null || !challenge.CanSetNewPassword(now))
        {
            return null;
        }

        var account = await accounts.FindByIdAsync(challenge.UserId, cancellationToken).ConfigureAwait(false);
        if (account is null || account.IsBlocked || (account.LockoutEnd is { } lockedUntil && lockedUntil > now))
        {
            return null;
        }

        return new PendingPasswordChange(challenge, account);
    }
}
