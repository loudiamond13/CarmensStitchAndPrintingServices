using Csps.Application.Email;
using Csps.Application.Ports;

namespace Csps.Application.Auth;

/// <summary>
/// The hourly cap on reset-link emails to one address (D-39), shared by forgot-password and a Manager's "send reset link" (USER-07),
/// so the two together can never send more than <see cref="AuthSettings.ResetEmailsPerHour"/> in the last hour.
/// </summary>
internal static class ResetEmailCap
{
    private static readonly TimeSpan Window = TimeSpan.FromHours(1);

    /// <summary>Tells whether the address already got the allowed number of reset-link emails in the last hour.</summary>
    /// <param name="outbox">The outbox to count in.</param>
    /// <param name="toAddress">The recipient address.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="settings">Holds the allowed number.</param>
    /// <param name="cancellationToken">Cancels the count.</param>
    /// <returns>True when no more may be sent.</returns>
    public static async Task<bool> IsReachedAsync(IEmailOutbox outbox, string toAddress, DateTimeOffset now, AuthSettings settings, CancellationToken cancellationToken)
    {
        var since = now - Window;
        var sent = await outbox.CountRecentAsync(AuthEmailKind.PasswordReset, toAddress, since, cancellationToken).ConfigureAwait(false);
        if (sent >= settings.ResetEmailsPerHour)
        {
            return true;
        }

        sent += await outbox.CountRecentAsync(AuthEmailKind.ManagerResetLink, toAddress, since, cancellationToken).ConfigureAwait(false);
        return sent >= settings.ResetEmailsPerHour;
    }
}
