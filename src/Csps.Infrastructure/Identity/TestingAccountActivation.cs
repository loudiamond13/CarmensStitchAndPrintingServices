#if CSPS_TESTING
using System.Globalization;
using Microsoft.AspNetCore.Identity;

namespace Csps.Infrastructure.Identity;

/// <summary>
/// Deactivates an account for the Testing-only fixture endpoint (QUAL-05). Debug builds only; the production port
/// has no such method because deactivation belongs to user management.
/// </summary>
/// <param name="users">The Identity user manager.</param>
public sealed class TestingAccountActivation(UserManager<ApplicationUser> users)
{
    /// <summary>Marks the account inactive.</summary>
    /// <param name="id">The account id.</param>
    /// <returns>A task that completes when the change is saved.</returns>
    /// <exception cref="InvalidOperationException">The account does not exist or could not be updated.</exception>
    public async Task DeactivateAsync(Guid id)
    {
        var user = await users.FindByIdAsync(id.ToString("D", CultureInfo.InvariantCulture)).ConfigureAwait(false)
            ?? throw new InvalidOperationException("The account does not exist.");
        user.IsActive = false;
        var result = await users.UpdateAsync(user).ConfigureAwait(false);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException("Deactivating the account failed.");
        }
    }
}
#endif
