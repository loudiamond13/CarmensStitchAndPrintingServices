using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Common;

namespace Csps.Application.Users;

/// <summary>
/// The shared rule behind every roster change that can hurt the shop (D-18, D-19): a Manager never acts on their own account, and
/// the last active Manager is never removed. Deactivate uses it now; demote, lock and delete reuse it. The caller takes
/// <see cref="IManagerRosterLock"/> first, so the count below is the real one.
/// </summary>
/// <param name="accounts">The staff accounts.</param>
public sealed class ManagerGuard(IUserAccounts accounts)
{
    /// <summary>Tells whether an account counts as an active Manager (D-18). A failed-password lockout does not matter here.</summary>
    /// <param name="account">The account.</param>
    /// <returns>True for role Manager, active, not deleted and not Manager-locked.</returns>
    public static bool IsActiveManager(UserAccount account)
    {
        ArgumentNullException.ThrowIfNull(account);
        return string.Equals(account.Role, Roles.Manager, StringComparison.Ordinal) && account.IsActive && !account.IsDeleted && !account.IsManagerLocked;
    }

    /// <summary>Checks one change against both rules.</summary>
    /// <param name="target">The account the change is for.</param>
    /// <param name="callerId">The signed-in Manager.</param>
    /// <param name="removesActiveManager">True when the change takes the target out of the active Managers (deactivate, demote, lock, delete).</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>Success, a 422 <c>users.own-account</c> for the caller's own account, or a 422 <c>users.last-active-manager</c>.</returns>
    public async Task<Result> CheckAsync(UserAccount target, Guid callerId, bool removesActiveManager, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(target);

        if (target.Id == callerId)
        {
            return Result.Failure(UserErrors.OwnAccount);
        }

        if (removesActiveManager
            && IsActiveManager(target)
            && await accounts.CountActiveManagersAsync(target.Id, cancellationToken).ConfigureAwait(false) == 0)
        {
            return Result.Failure(UserErrors.LastActiveManager);
        }

        return Result.Success();
    }
}
