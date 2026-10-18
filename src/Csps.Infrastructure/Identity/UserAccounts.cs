using System.Globalization;
using System.Security.Cryptography;
using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Identity;
using Csps.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Identity;

/// <summary>
/// <see cref="IUserAccounts"/> over Identity's <see cref="UserManager{TUser}"/>. There is no sign-in manager: it
/// answers a locked account before hashing, which is a timing oracle (CWE-204). Identity's password validators are
/// skipped on purpose because the password rule lives in <see cref="PasswordPolicy"/> and the handlers.
/// </summary>
/// <remarks>
/// <c>UserManager</c> saves on the shared scoped context, so callers order their work as Pitfall 13 says: finish
/// every tracked entity before the first call here.
/// </remarks>
internal sealed class UserAccounts(
    UserManager<ApplicationUser> users,
    RoleManager<IdentityRole<Guid>> roles,
    IPasswordHasher<ApplicationUser> hasher,
    CspsDbContext context,
    TimeProvider time) : IUserAccounts
{
    // Parallel wrong guesses each lose the row to one another; every loser reloads and counts again.
    private const int CountAttempts = 16;

    private static readonly Lazy<string> DummyHash = new(() =>
        new PasswordHasher<ApplicationUser>().HashPassword(new ApplicationUser(), Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))));

    public async Task<UserAccount?> FindByEmailAsync(string email, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var user = await users.FindByEmailAsync(email).ConfigureAwait(false);
        return user is null ? null : await ToAccountAsync(user).ConfigureAwait(false);
    }

    public async Task<UserAccount?> FindByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var user = await users.FindByIdAsync(Key(id)).ConfigureAwait(false);
        return user is null ? null : await ToAccountAsync(user).ConfigureAwait(false);
    }

    public async Task<Guid> CreateAsync(NewUserAccount account, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(account);
        cancellationToken.ThrowIfCancellationRequested();

        if (!await roles.RoleExistsAsync(account.Role).ConfigureAwait(false))
        {
            throw new InvalidOperationException($"The role '{account.Role}' does not exist.");
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = account.Email,
            Email = account.Email,
            FirstName = account.FirstName,
            LastName = account.LastName,
            EmailConfirmed = account.Password is not null,
            CreatedAtUtc = time.GetUtcNow(),
        };
        if (account.Password is not null)
        {
            user.PasswordHash = hasher.HashPassword(user, PasswordPolicy.Normalize(account.Password));
        }

        Require(await users.CreateAsync(user).ConfigureAwait(false), "Creating the account");
        Require(await users.AddToRoleAsync(user, account.Role).ConfigureAwait(false), "Assigning the role");
        return user.Id;
    }

    public async Task<PasswordCheck> CheckPasswordAsync(Guid id, string password, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(password);
        cancellationToken.ThrowIfCancellationRequested();
        var normalized = PasswordPolicy.Normalize(password);

        var user = await users.FindByIdAsync(Key(id)).ConfigureAwait(false);
        if (user?.PasswordHash is null)
        {
            // Same hashing work as a real check, so a missing account or password costs the same time.
            VerifyDummy(normalized);
            return PasswordCheck.Failed;
        }

        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, normalized);
        if (result == PasswordVerificationResult.Failed)
        {
            return PasswordCheck.Failed;
        }

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            // The password is right, so a failed upgrade must not fail the sign-in; the next check tries again.
            user.PasswordHash = hasher.HashPassword(user, normalized);
            _ = await users.UpdateAsync(user).ConfigureAwait(false);
        }

        return PasswordCheck.Succeeded;
    }

    public void VerifyDummyPassword(string password)
    {
        ArgumentNullException.ThrowIfNull(password);
        VerifyDummy(PasswordPolicy.Normalize(password));
    }

    public async Task<FailedPasswordResult> RecordFailedPasswordAsync(Guid id, CancellationToken cancellationToken)
    {
        var user = await LoadAsync(id, cancellationToken).ConfigureAwait(false);

        for (var attempt = 1; ; attempt++)
        {
            var wasLocked = await users.IsLockedOutAsync(user).ConfigureAwait(false);
            var result = await users.AccessFailedAsync(user).ConfigureAwait(false);
            if (result.Succeeded)
            {
                var isLocked = await users.IsLockedOutAsync(user).ConfigureAwait(false);
                return new FailedPasswordResult(!wasLocked && isLocked, isLocked ? user.LockoutEnd : null);
            }

            if (attempt == CountAttempts || !result.Errors.Any(static error => error.Code == nameof(IdentityErrorDescriber.ConcurrencyFailure)))
            {
                Require(result, "Counting the failed password");
            }

            // The row changed under us: read the other guess's count and add this one to it.
            await context.Entry(user).ReloadAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task ResetFailedCountAsync(Guid id, CancellationToken cancellationToken)
    {
        var user = await LoadAsync(id, cancellationToken).ConfigureAwait(false);
        Require(await users.ResetAccessFailedCountAsync(user).ConfigureAwait(false), "Resetting the failed count");
    }

    public async Task<bool> IsLockedOutAsync(Guid id, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var user = await users.FindByIdAsync(Key(id)).ConfigureAwait(false);
        return user is not null && await users.IsLockedOutAsync(user).ConfigureAwait(false);
    }

    public async Task LockUntilAsync(Guid id, DateTimeOffset until, CancellationToken cancellationToken)
    {
        var user = await LoadAsync(id, cancellationToken).ConfigureAwait(false);
        Require(await users.SetLockoutEndDateAsync(user, until).ConfigureAwait(false), "Locking the account");
    }

    public async Task ClearLockoutAsync(Guid id, CancellationToken cancellationToken)
    {
        var user = await LoadAsync(id, cancellationToken).ConfigureAwait(false);
        Require(await users.SetLockoutEndDateAsync(user, null).ConfigureAwait(false), "Ending the lockout");
        Require(await users.ResetAccessFailedCountAsync(user).ConfigureAwait(false), "Resetting the failed count");
    }

    public async Task SetPasswordAsync(Guid id, string newPassword, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(newPassword);
        var user = await LoadAsync(id, cancellationToken).ConfigureAwait(false);

        // One save: the new hash and the new security stamp, so the old password never works with the new stamp.
        user.PasswordHash = hasher.HashPassword(user, PasswordPolicy.Normalize(newPassword));
        Require(await users.UpdateSecurityStampAsync(user).ConfigureAwait(false), "Setting the password");
    }

    public Task ConfirmEmailAsync(Guid id, CancellationToken cancellationToken) =>
        UpdateAsync(id, user => user.EmailConfirmed = true, cancellationToken);

    public Task SetMustChangePasswordAsync(Guid id, PasswordChangeReason reason, CancellationToken cancellationToken) =>
        UpdateAsync(id, user =>
        {
            user.MustChangePassword = true;
            user.MustChangePasswordReason = reason;
        }, cancellationToken);

    public Task ClearMustChangePasswordAsync(Guid id, CancellationToken cancellationToken) =>
        UpdateAsync(id, user =>
        {
            user.MustChangePassword = false;
            user.MustChangePasswordReason = null;
        }, cancellationToken);

    public Task MarkBreachRecheckAsync(Guid id, CancellationToken cancellationToken) =>
        UpdateAsync(id, user => user.BreachRecheckPending = true, cancellationToken);

    public Task ClearBreachRecheckAsync(Guid id, CancellationToken cancellationToken) =>
        UpdateAsync(id, user => user.BreachRecheckPending = false, cancellationToken);

    public async Task<bool> AnyActiveManagerAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var managers = await users.GetUsersInRoleAsync(Roles.Manager).ConfigureAwait(false);
        return managers.Any(static manager => manager.IsActive);
    }

    private static string Key(Guid id) => id.ToString("D", CultureInfo.InvariantCulture);

    private static void Require(IdentityResult result, string action)
    {
        if (!result.Succeeded)
        {
            // Error codes only: descriptions can echo the email address.
            throw new InvalidOperationException($"{action} failed: {string.Join(", ", result.Errors.Select(static error => error.Code))}.");
        }
    }

    private void VerifyDummy(string normalizedPassword) =>
        _ = hasher.VerifyHashedPassword(new ApplicationUser(), DummyHash.Value, normalizedPassword);

    private async Task<ApplicationUser> LoadAsync(Guid id, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return await users.FindByIdAsync(Key(id)).ConfigureAwait(false)
            ?? throw new InvalidOperationException("The account does not exist.");
    }

    private async Task UpdateAsync(Guid id, Action<ApplicationUser> change, CancellationToken cancellationToken)
    {
        var user = await LoadAsync(id, cancellationToken).ConfigureAwait(false);
        change(user);
        Require(await users.UpdateAsync(user).ConfigureAwait(false), "Updating the account");
    }

    private async Task<UserAccount> ToAccountAsync(ApplicationUser user)
    {
        var assigned = await users.GetRolesAsync(user).ConfigureAwait(false);
        return new UserAccount(
            user.Id,
            user.Email ?? string.Empty,
            user.FirstName,
            user.LastName,
            assigned.FirstOrDefault() ?? string.Empty,
            user.IsActive,
            user.EmailConfirmed,
            user.PasswordHash is not null,
            user.MustChangePassword ? user.MustChangePasswordReason : null,
            user.BreachRecheckPending,
            user.LockoutEnd,
            user.ManagerLockedAtUtc is not null,
            user.DeletedAtUtc is not null);
    }
}
