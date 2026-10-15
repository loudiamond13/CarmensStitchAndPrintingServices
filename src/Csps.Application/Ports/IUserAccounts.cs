using Csps.Application.Auth;
using Csps.Domain.Identity;

namespace Csps.Application.Ports;

/// <summary>
/// Everything the sign-in, reset, must-change and bootstrap handlers need from staff accounts (AUTH-01, AUTH-07,
/// AUTH-10). Application never sees Identity: the implementation maps to <see cref="UserAccount"/>, and it
/// normalizes every password with <c>PasswordPolicy.Normalize</c> (NFC) before hashing or verifying.
/// </summary>
/// <remarks>
/// Changes are saved on the caller's scoped database context, as Identity does, so anything else tracked at that
/// moment is saved with them. Order the work so tracked entities are complete before the first call. Changing an
/// account that does not exist throws <see cref="InvalidOperationException"/>.
/// </remarks>
public interface IUserAccounts
{
    /// <summary>Finds an account by email, in any letter case.</summary>
    /// <param name="email">The email.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>The account, or null.</returns>
    Task<UserAccount?> FindByEmailAsync(string email, CancellationToken cancellationToken);

    /// <summary>Finds an account by id.</summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>The account, or null.</returns>
    Task<UserAccount?> FindByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Creates an account with one role.</summary>
    /// <param name="account">The details.</param>
    /// <param name="cancellationToken">Cancels the create.</param>
    /// <returns>The new account id.</returns>
    /// <exception cref="InvalidOperationException">The email is taken or the role does not exist.</exception>
    Task<Guid> CreateAsync(NewUserAccount account, CancellationToken cancellationToken);

    /// <summary>Checks a password. An unknown id, or an account without a password, fails after the same hashing work.</summary>
    /// <param name="id">The account id.</param>
    /// <param name="password">The password as typed.</param>
    /// <param name="cancellationToken">Cancels the check.</param>
    /// <returns>Whether the password matches.</returns>
    Task<PasswordCheck> CheckPasswordAsync(Guid id, string password, CancellationToken cancellationToken);

    /// <summary>Runs one password verification against a throwaway hash, so an unknown email costs the same time as a known one (CWE-204).</summary>
    /// <param name="password">The password as typed.</param>
    void VerifyDummyPassword(string password);

    /// <summary>Counts a wrong password. Five in a row lock the account for 15 minutes.</summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the update.</param>
    /// <returns>Whether this failure caused the lockout, so the lockout email goes out once.</returns>
    Task<FailedPasswordResult> RecordFailedPasswordAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Sets the failed-password count back to zero.</summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the update.</param>
    /// <returns>A task that completes when the count is saved.</returns>
    Task ResetFailedCountAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Tells whether the account is locked right now.</summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>True while locked.</returns>
    Task<bool> IsLockedOutAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Locks the account until a time.</summary>
    /// <param name="id">The account id.</param>
    /// <param name="until">When the lockout ends.</param>
    /// <param name="cancellationToken">Cancels the update.</param>
    /// <returns>A task that completes when the lockout is saved.</returns>
    Task LockUntilAsync(Guid id, DateTimeOffset until, CancellationToken cancellationToken);

    /// <summary>Ends any lockout and sets the failed-password count back to zero.</summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the update.</param>
    /// <returns>A task that completes when the change is saved.</returns>
    Task ClearLockoutAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Sets a new password and renews the security stamp. The caller has already checked the password rules.</summary>
    /// <param name="id">The account id.</param>
    /// <param name="newPassword">The new password as typed.</param>
    /// <param name="cancellationToken">Cancels the update.</param>
    /// <returns>A task that completes when the password is saved.</returns>
    Task SetPasswordAsync(Guid id, string newPassword, CancellationToken cancellationToken);

    /// <summary>Requires a new password at the next sign-in (D-13).</summary>
    /// <param name="id">The account id.</param>
    /// <param name="reason">Why.</param>
    /// <param name="cancellationToken">Cancels the update.</param>
    /// <returns>A task that completes when the flag is saved.</returns>
    Task SetMustChangePasswordAsync(Guid id, PasswordChangeReason reason, CancellationToken cancellationToken);

    /// <summary>Removes the must-change flag and its reason.</summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the update.</param>
    /// <returns>A task that completes when the flag is saved.</returns>
    Task ClearMustChangePasswordAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Marks the password to be checked against the breach list at the next sign-in (D-14).</summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the update.</param>
    /// <returns>A task that completes when the mark is saved.</returns>
    Task MarkBreachRecheckAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Removes the breach re-check mark.</summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the update.</param>
    /// <returns>A task that completes when the mark is saved.</returns>
    Task ClearBreachRecheckAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Tells whether any active Manager exists (the bootstrap command only runs when none does).</summary>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>True when at least one active Manager exists.</returns>
    Task<bool> AnyActiveManagerAsync(CancellationToken cancellationToken);
}

/// <summary>The result of checking a password.</summary>
public enum PasswordCheck
{
    /// <summary>The password does not match.</summary>
    Failed = 0,

    /// <summary>The password matches.</summary>
    Succeeded = 1,
}

/// <summary>The result of counting a wrong password.</summary>
/// <param name="LockedNow">True only for the failure that moved the account from unlocked to locked.</param>
/// <param name="LockoutEnd">When the lockout ends; null while the account is not locked.</param>
public readonly record struct FailedPasswordResult(bool LockedNow, DateTimeOffset? LockoutEnd);
