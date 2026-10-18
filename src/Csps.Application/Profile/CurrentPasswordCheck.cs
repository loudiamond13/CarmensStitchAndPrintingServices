using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Profile;

/// <summary>
/// The current-password proof every security action in My Profile asks for (D-41 Q9, CWE-307): the password change and the
/// email change. A locked account is refused without a password check. A wrong password is counted toward the same
/// five-try lockout as sign-in, and the try that locks the account also queues the one lockout email and its audit entry in
/// the same transaction (T-04-39). Neither password reaches a log, an audit entry or a response.
/// </summary>
public sealed class CurrentPasswordCheck(
    IUserAccounts accounts,
    IEmailOutbox outbox,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    AuthSettings settings,
    TimeProvider time)
{
    private const string UserTarget = "User";

    /// <summary>Checks the password the caller typed against their own account.</summary>
    /// <param name="account">The caller's account, already known to be usable.</param>
    /// <param name="currentPassword">The password as typed.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success when the password matches, a 429 while the account is locked (this try included), or a 400 on the current-password field.</returns>
    public async Task<Result> CheckAsync(UserAccount account, string currentPassword, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(account);
        ArgumentNullException.ThrowIfNull(currentPassword);

        var now = time.GetUtcNow();
        if (account.LockoutEnd is { } lockedUntil && lockedUntil > now)
        {
            return Result.Failure(ProfileErrors.PasswordLocked(lockedUntil - now));
        }

        if (await accounts.CheckPasswordAsync(account.Id, currentPassword, cancellationToken).ConfigureAwait(false) == PasswordCheck.Succeeded)
        {
            return Result.Success();
        }

        return await CountWrongPasswordAsync(account, cancellationToken).ConfigureAwait(false);
    }

    // The count, and when it locks the account the one lockout email and its audit entry, commit together.
    private async Task<Result> CountWrongPasswordAsync(UserAccount account, CancellationToken cancellationToken)
    {
        var failure = await unitOfWork.InTransactionAsync(
            async token =>
            {
                var result = await accounts.RecordFailedPasswordAsync(account.Id, token).ConfigureAwait(false);
                if (result.LockedNow)
                {
                    // LockoutEnd is always set when LockedNow is true (IUserAccounts contract).
                    await outbox.EnqueueAsync(new AccountLockedEmail(account.Email, result.LockoutEnd!.Value, LockoutCause.Password, settings.PasswordLockoutDuration), token).ConfigureAwait(false);
                    audit.Record(AuditActions.Lockout, UserTarget, AuditKey.Of(account.Id), AuditActions.DetailPassword);
                    await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                }

                return result;
            },
            cancellationToken).ConfigureAwait(false);

        return Result.Failure(failure.LockedNow ? ProfileErrors.PasswordLocked(failure.LockoutEnd!.Value - time.GetUtcNow()) : ProfileErrors.WrongPassword);
    }
}
