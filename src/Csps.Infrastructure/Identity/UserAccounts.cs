using System.Globalization;
using System.Security.Cryptography;
using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Users;
using Csps.Domain.Identity;
using Csps.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
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
            EmailConfirmed = account.Password is not null && !account.KeepEmailUnconfirmed,
            CreatedAtUtc = time.GetUtcNow(),
        };
        if (account.Password is not null)
        {
            user.PasswordHash = hasher.HashPassword(user, PasswordPolicy.Normalize(account.Password));
        }

        IdentityResult created;
        try
        {
            created = await users.CreateAsync(user).ConfigureAwait(false);
        }
        catch (DbUpdateException error) when (error.InnerException is SqlException { Number: 2601 or 2627 })
        {
            // Two creates took the address in the same instant; the unique index let one through. The failed row must leave the
            // context, or the next save on this request would try to insert it again.
            context.Entry(user).State = EntityState.Detached;
            throw new EmailInUseException();
        }

        if (created.Errors.Any(static error => error.Code is nameof(IdentityErrorDescriber.DuplicateEmail) or nameof(IdentityErrorDescriber.DuplicateUserName)))
        {
            throw new EmailInUseException();
        }

        Require(created, "Creating the account");
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

    public async Task MarkStaffEditAsync(Guid id, CancellationToken cancellationToken)
    {
        for (var attempt = 1; ; attempt++)
        {
            var user = await LoadAsync(id, cancellationToken).ConfigureAwait(false);
            user.EditVersion = Guid.NewGuid();
            var result = await users.UpdateAsync(user).ConfigureAwait(false);
            if (result.Succeeded)
            {
                return;
            }

            if (attempt == CountAttempts || !IsConcurrencyFailure(result))
            {
                Require(result, "Recording the staff edit");
            }

            // The row changed under us (a failed-password count, say): read the fresh row and try again.
            await context.Entry(user).ReloadAsync(cancellationToken).ConfigureAwait(false);
        }
    }

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

    public async Task<int> CountActiveManagersAsync(Guid? excluding, CancellationToken cancellationToken)
    {
        var managerRole = await roles.FindByNameAsync(Roles.Manager).ConfigureAwait(false);
        if (managerRole is null)
        {
            return 0;
        }

        return await context.Users.AsNoTracking()
            .Where(user => user.IsActive && user.ManagerLockedAtUtc == null && user.DeletedAtUtc == null && user.Id != excluding)
            .CountAsync(user => context.UserRoles.Any(link => link.UserId == user.Id && link.RoleId == managerRole.Id), cancellationToken)
            .ConfigureAwait(false);
    }

    public async Task<bool> SetActiveAsync(Guid id, bool active, CancellationToken cancellationToken)
    {
        for (var attempt = 1; ; attempt++)
        {
            var user = await LoadAsync(id, cancellationToken).ConfigureAwait(false);
            if (user.IsActive == active)
            {
                return false;
            }

            user.IsActive = active;
            user.EditVersion = Guid.NewGuid();
            var result = await users.UpdateAsync(user).ConfigureAwait(false);
            if (result.Succeeded)
            {
                return true;
            }

            if (attempt == CountAttempts || !IsConcurrencyFailure(result))
            {
                Require(result, "Changing the account state");
            }

            // The row changed under us (a failed-password count, say): read the fresh row and decide again.
            await context.Entry(user).ReloadAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task<bool> SetManagerLockAsync(Guid id, DateTimeOffset? lockedAt, CancellationToken cancellationToken)
    {
        for (var attempt = 1; ; attempt++)
        {
            var user = await LoadAsync(id, cancellationToken).ConfigureAwait(false);
            if ((user.ManagerLockedAtUtc is not null) == lockedAt.HasValue)
            {
                return false;
            }

            user.ManagerLockedAtUtc = lockedAt;
            user.EditVersion = Guid.NewGuid();
            var result = await users.UpdateAsync(user).ConfigureAwait(false);
            if (result.Succeeded)
            {
                return true;
            }

            if (attempt == CountAttempts || !IsConcurrencyFailure(result))
            {
                Require(result, "Changing the Manager lock");
            }

            // The row changed under us (a failed-password count, say): read the fresh row and decide again.
            await context.Entry(user).ReloadAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task<bool> SoftDeleteAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var scrambled = DeletedAddress.For(id);
        for (var attempt = 1; ; attempt++)
        {
            var user = await LoadAsync(id, cancellationToken).ConfigureAwait(false);
            if (user.DeletedAtUtc is not null)
            {
                return false;
            }

            user.Email = scrambled;
            user.UserName = scrambled;
            user.NormalizedEmail = users.NormalizeEmail(scrambled);
            user.NormalizedUserName = users.NormalizeName(scrambled);
            user.PendingEmail = null;
            user.DeletedAtUtc = now;
            user.EditVersion = Guid.NewGuid();
            user.SecurityStamp = Guid.NewGuid().ToString("D", CultureInfo.InvariantCulture);
            var result = await users.UpdateAsync(user).ConfigureAwait(false);
            if (result.Succeeded)
            {
                return true;
            }

            if (attempt == CountAttempts || !IsConcurrencyFailure(result))
            {
                Require(result, "Deleting the account");
            }

            // The row changed under us (a failed-password count, say): read the fresh row and decide again.
            await context.Entry(user).ReloadAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task<EditResult> UpdateNameAsync(Guid id, string firstName, string lastName, Guid expectedVersion, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(firstName);
        ArgumentNullException.ThrowIfNull(lastName);
        var edit = await UpdateDetailsAsync(id, new UserDetailsChange(firstName, lastName), expectedVersion, cancellationToken).ConfigureAwait(false);
        return edit.Edit;
    }

    public async Task<DetailsEditResult> UpdateDetailsAsync(Guid id, UserDetailsChange change, Guid expectedVersion, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(change);
        cancellationToken.ThrowIfCancellationRequested();

        var user = await users.FindByIdAsync(Key(id)).ConfigureAwait(false);
        if (user is null)
        {
            return new DetailsEditResult(EditOutcome.NotFound, Guid.Empty, []);
        }

        for (var attempt = 1; ; attempt++)
        {
            if (user.EditVersion != expectedVersion)
            {
                return new DetailsEditResult(EditOutcome.Stale, user.EditVersion, []);
            }

            var changed = new List<string>(3);
            if (!string.Equals(user.FirstName, change.FirstName, StringComparison.Ordinal))
            {
                changed.Add(EditedFields.FirstName);
            }

            if (!string.Equals(user.LastName, change.LastName, StringComparison.Ordinal))
            {
                changed.Add(EditedFields.LastName);
            }

            var emailChanges = change.Email is not null && !string.Equals(user.Email, change.Email, StringComparison.OrdinalIgnoreCase);
            if (emailChanges)
            {
                changed.Add(EditedFields.Email);
            }

            var previousRole = change.Role is null ? null : (await users.GetRolesAsync(user).ConfigureAwait(false)).FirstOrDefault();
            var roleChanges = change.Role is not null && !string.Equals(previousRole, change.Role, StringComparison.Ordinal);
            if (roleChanges)
            {
                changed.Add(EditedFields.Role);
            }

            if (changed.Count == 0)
            {
                return new DetailsEditResult(EditOutcome.Unchanged, user.EditVersion, []);
            }

            // Looked up before the version is rotated, so an unknown role leaves the account untouched.
            var newRole = roleChanges
                ? await roles.FindByNameAsync(change.Role!).ConfigureAwait(false) ?? throw new InvalidOperationException($"The role '{change.Role}' does not exist.")
                : null;

            // Checked before anything is set, so a taken address leaves the account untouched (the unique index decides a race below).
            var normalizedEmail = emailChanges ? users.NormalizeEmail(change.Email) : null;
            if (emailChanges && await IsAddressHeldByAnotherAsync(id, normalizedEmail!, cancellationToken).ConfigureAwait(false))
            {
                return new DetailsEditResult(EditOutcome.EmailTaken, user.EditVersion, []);
            }

            // The UPDATE's WHERE carries the version the form was opened with, so a racing save changes no row.
            context.Entry(user).Property(static account => account.EditVersion).OriginalValue = expectedVersion;
            user.FirstName = change.FirstName;
            user.LastName = change.LastName;
            if (emailChanges)
            {
                user.Email = change.Email;
                user.UserName = change.Email;
                user.NormalizedEmail = normalizedEmail;
                user.NormalizedUserName = users.NormalizeName(change.Email);
                user.PendingEmail = null;
            }

            user.EditVersion = Guid.NewGuid();

            IdentityResult result;
            try
            {
                result = await users.UpdateAsync(user).ConfigureAwait(false);
            }
            catch (DbUpdateException error) when (emailChanges && error.InnerException is SqlException { Number: 2601 or 2627 })
            {
                // Two accounts took the address in the same instant; the unique index let one through.
                await context.Entry(user).ReloadAsync(cancellationToken).ConfigureAwait(false);
                return new DetailsEditResult(EditOutcome.EmailTaken, user.EditVersion, []);
            }

            if (result.Succeeded)
            {
                if (newRole is not null)
                {
                    await SwapRoleAsync(id, newRole.Id, cancellationToken).ConfigureAwait(false);
                }

                return new DetailsEditResult(EditOutcome.Saved, user.EditVersion, changed, roleChanges ? previousRole : null);
            }

            if (emailChanges && result.Errors.Any(static error => error.Code is nameof(IdentityErrorDescriber.DuplicateEmail) or nameof(IdentityErrorDescriber.DuplicateUserName)))
            {
                await context.Entry(user).ReloadAsync(cancellationToken).ConfigureAwait(false);
                return new DetailsEditResult(EditOutcome.EmailTaken, user.EditVersion, []);
            }

            if (attempt == CountAttempts || !IsConcurrencyFailure(result))
            {
                Require(result, "Changing the details");
            }

            // The row changed under us: bookkeeping (the stamp) retries on the fresh row, a staff edit is stale at the top of the loop.
            await context.Entry(user).ReloadAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task SetPendingEmailAsync(Guid id, string? email, CancellationToken cancellationToken)
    {
        for (var attempt = 1; ; attempt++)
        {
            var user = await LoadAsync(id, cancellationToken).ConfigureAwait(false);
            user.PendingEmail = email;
            var result = await users.UpdateAsync(user).ConfigureAwait(false);
            if (result.Succeeded)
            {
                return;
            }

            if (attempt == CountAttempts || !IsConcurrencyFailure(result))
            {
                Require(result, "Setting the pending email");
            }

            // The pending address is not version-guarded, so a racing edit just means: read the fresh row and set it again.
            await context.Entry(user).ReloadAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task<EmailApplyOutcome> ApplyPendingEmailAsync(Guid id, CancellationToken cancellationToken)
    {
        for (var attempt = 1; ; attempt++)
        {
            var user = await LoadAsync(id, cancellationToken).ConfigureAwait(false);
            if (user.PendingEmail is not { Length: > 0 } pending)
            {
                return EmailApplyOutcome.NothingPending;
            }

            var normalized = users.NormalizeEmail(pending);
            if (await context.Users.AnyAsync(
                other => other.Id != id && (other.NormalizedEmail == normalized || other.NormalizedUserName == normalized), cancellationToken).ConfigureAwait(false))
            {
                return EmailApplyOutcome.Taken;
            }

            user.Email = pending;
            user.UserName = pending;
            user.NormalizedEmail = normalized;
            user.NormalizedUserName = users.NormalizeName(pending);
            user.PendingEmail = null;
            user.EditVersion = Guid.NewGuid();
            user.UpdatedById = id;

            IdentityResult result;
            try
            {
                result = await users.UpdateAsync(user).ConfigureAwait(false);
            }
            catch (DbUpdateException error) when (error.InnerException is SqlException { Number: 2601 or 2627 })
            {
                // Two accounts took the address in the same instant; the unique index let one through.
                await context.Entry(user).ReloadAsync(cancellationToken).ConfigureAwait(false);
                return EmailApplyOutcome.Taken;
            }

            if (result.Succeeded)
            {
                await KeepAccountAsLastChangerAsync(user, id).ConfigureAwait(false);
                return EmailApplyOutcome.Applied;
            }

            if (result.Errors.Any(static error => error.Code is nameof(IdentityErrorDescriber.DuplicateEmail) or nameof(IdentityErrorDescriber.DuplicateUserName)))
            {
                await context.Entry(user).ReloadAsync(cancellationToken).ConfigureAwait(false);
                return EmailApplyOutcome.Taken;
            }

            if (attempt == CountAttempts || !IsConcurrencyFailure(result))
            {
                Require(result, "Changing the email");
            }

            await context.Entry(user).ReloadAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    private Task<bool> IsAddressHeldByAnotherAsync(Guid id, string normalized, CancellationToken cancellationToken) =>
        context.Users.AnyAsync(
            other => other.Id != id && (other.NormalizedEmail == normalized || other.NormalizedUserName == normalized), cancellationToken);

    // A person holds exactly one role. Only the link rows change, so the account row is not written a second time.
    private async Task SwapRoleAsync(Guid id, Guid roleId, CancellationToken cancellationToken)
    {
        var links = await context.UserRoles.Where(link => link.UserId == id).ToListAsync(cancellationToken).ConfigureAwait(false);
        context.UserRoles.RemoveRange(links);
        context.UserRoles.Add(new IdentityUserRole<Guid> { UserId = id, RoleId = roleId });
        _ = await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    // The stamp interceptor writes the signed-in user, or null with nobody signed in, over an unchanged UpdatedById. A second
    // save that leaves the edit version alone is not a staff edit, so it is not stamped and the account itself stays on record.
    private async Task KeepAccountAsLastChangerAsync(ApplicationUser user, Guid id)
    {
        if (user.UpdatedById != id)
        {
            user.UpdatedById = id;
            Require(await users.UpdateAsync(user).ConfigureAwait(false), "Recording the last changer");
        }
    }

    private static bool IsConcurrencyFailure(IdentityResult result) =>
        result.Errors.Any(static error => error.Code == nameof(IdentityErrorDescriber.ConcurrencyFailure));

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
