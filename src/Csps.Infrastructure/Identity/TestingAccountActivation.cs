#if CSPS_TESTING
using System.Globalization;
using Microsoft.AspNetCore.Identity;

namespace Csps.Infrastructure.Identity;

/// <summary>
/// Deactivates or Manager-locks an account for the Testing-only fixture endpoint (QUAL-05). Debug builds only; the
/// production port has no such methods because both belong to user management.
/// </summary>
/// <param name="users">The Identity user manager.</param>
/// <param name="time">The clock.</param>
public sealed class TestingAccountActivation(UserManager<ApplicationUser> users, TimeProvider time)
{
    /// <summary>Marks the account inactive.</summary>
    /// <param name="id">The account id.</param>
    /// <returns>A task that completes when the change is saved.</returns>
    /// <exception cref="InvalidOperationException">The account does not exist or could not be updated.</exception>
    public async Task DeactivateAsync(Guid id)
    {
        var user = await FindAsync(id).ConfigureAwait(false);
        user.IsActive = false;
        await SaveAsync(user, "Deactivating the account failed.").ConfigureAwait(false);
    }

    /// <summary>Sets the Manager lock (D-16), separate from the failed-password lockout.</summary>
    /// <param name="id">The account id.</param>
    /// <returns>A task that completes when the change is saved.</returns>
    /// <exception cref="InvalidOperationException">The account does not exist or could not be updated.</exception>
    public async Task ManagerLockAsync(Guid id)
    {
        var user = await FindAsync(id).ConfigureAwait(false);
        user.ManagerLockedAtUtc = time.GetUtcNow();
        await SaveAsync(user, "Locking the account failed.").ConfigureAwait(false);
    }

    private async Task<ApplicationUser> FindAsync(Guid id) =>
        await users.FindByIdAsync(id.ToString("D", CultureInfo.InvariantCulture)).ConfigureAwait(false)
            ?? throw new InvalidOperationException("The account does not exist.");

    private async Task SaveAsync(ApplicationUser user, string failure)
    {
        var result = await users.UpdateAsync(user).ConfigureAwait(false);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(failure);
        }
    }
}
#endif
