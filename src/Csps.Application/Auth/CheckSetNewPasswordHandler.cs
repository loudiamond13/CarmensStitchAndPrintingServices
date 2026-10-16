using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Auth;

/// <summary>What the must-change screen needs to apply the password rule in the browser (OR-3).</summary>
/// <param name="Email">The account email.</param>
/// <param name="FirstName">The account given name.</param>
/// <param name="LastName">The account family name.</param>
/// <param name="Reason">Why a new password is needed.</param>
public sealed record SetNewPasswordContext(string Email, string FirstName, string LastName, PasswordChangeReason Reason);

/// <summary>
/// Use case: tell the must-change screen who it is for and why, on every arrival (AUTH-11). Only a pending sign-in that
/// passed the code step and is still usable gets an answer; every other case is the same 401. It changes nothing, so
/// the ticket is not spent.
/// </summary>
public sealed class CheckSetNewPasswordHandler(ITwoFactorChallenges challenges, IUserAccounts accounts, TimeProvider time)
{
    /// <summary>Reads the context of one pending sign-in.</summary>
    /// <param name="ticket">The pending-login ticket from its cookie; null or empty when the cookie is missing.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The account email, names and reason, or a 401 when the pending sign-in cannot take a new password.</returns>
    public async Task<Result<SetNewPasswordContext>> HandleAsync(string? ticket, CancellationToken cancellationToken)
    {
        var pending = await PendingPasswordChangeLookup.FindAsync(ticket, time.GetUtcNow(), challenges, accounts, cancellationToken).ConfigureAwait(false);
        if (pending is null)
        {
            return Result.Failure<SetNewPasswordContext>(AuthErrors.TicketExpired);
        }

        var account = pending.Account;
        var reason = pending.Challenge.PasswordChangeReason ?? PasswordChangeReason.Temporary;
        return Result.Success(new SetNewPasswordContext(account.Email, account.FirstName, account.LastName, reason));
    }
}
