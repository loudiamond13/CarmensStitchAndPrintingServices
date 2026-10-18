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
    /// <exception cref="EmailInUseException">Another account already holds the email, including when two creates raced for it.</exception>
    /// <exception cref="InvalidOperationException">The role does not exist.</exception>
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

    /// <summary>Marks the email confirmed, once a link sent to that address has been followed (D-29).</summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the update.</param>
    /// <returns>A task that completes when the change is saved.</returns>
    Task ConfirmEmailAsync(Guid id, CancellationToken cancellationToken);

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

    /// <summary>
    /// Counts active Managers (D-18): role Manager, active, not deleted and not Manager-locked. A failed-password lockout does not
    /// count against a Manager. Call it under <see cref="IManagerRosterLock"/> so the answer cannot change before the caller acts.
    /// </summary>
    /// <param name="excluding">An account to leave out of the count, or null to count everyone.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>The number of active Managers.</returns>
    Task<int> CountActiveManagersAsync(Guid? excluding, CancellationToken cancellationToken);

    /// <summary>
    /// Deactivates or reactivates the account on its latest state, with no version to send (D-21). A change rotates the edit
    /// version, so a form opened earlier is stale, and counts as a staff edit for SEC-08.
    /// </summary>
    /// <param name="id">The account id.</param>
    /// <param name="active">True to reactivate, false to deactivate.</param>
    /// <param name="cancellationToken">Cancels the update.</param>
    /// <returns>True when the state changed; false when the account was already in that state, and nothing was written.</returns>
    Task<bool> SetActiveAsync(Guid id, bool active, CancellationToken cancellationToken);

    /// <summary>
    /// Sets or clears the Manager lock on the latest state, with no version to send (D-16, D-21). The lock has no timer and is
    /// separate from the failed-password lockout, which this never touches. A change rotates the edit version, so a form opened
    /// earlier is stale, and counts as a staff edit for SEC-08.
    /// </summary>
    /// <param name="id">The account id.</param>
    /// <param name="lockedAt">When the lock starts; null clears the lock.</param>
    /// <param name="cancellationToken">Cancels the update.</param>
    /// <returns>True when the lock state changed; false when it already was that way, and nothing was written.</returns>
    Task<bool> SetManagerLockAsync(Guid id, DateTimeOffset? lockedAt, CancellationToken cancellationToken);

    /// <summary>
    /// Changes the first and last name when <paramref name="expectedVersion"/> is the stored edit version, and rotates
    /// that version (SEC-07). Identity bookkeeping never rotates it. Names that already match change nothing.
    /// </summary>
    /// <param name="id">The account id.</param>
    /// <param name="firstName">The new given name, already trimmed.</param>
    /// <param name="lastName">The new family name, already trimmed.</param>
    /// <param name="expectedVersion">The edit version the form was opened with.</param>
    /// <param name="cancellationToken">Cancels the update.</param>
    /// <returns>Whether it saved, changed nothing, lost to another edit, or found no account, and the version now stored.</returns>
    Task<EditResult> UpdateNameAsync(Guid id, string firstName, string lastName, Guid expectedVersion, CancellationToken cancellationToken);

    /// <summary>
    /// Changes the details a Manager edits on another person (names, role and, when asked, the sign-in email) when
    /// <paramref name="expectedVersion"/> is the stored edit version, and rotates that version (SEC-07). Identity bookkeeping
    /// never rotates it. Values that already match change nothing. A role change swaps the person's one role in the same
    /// unit of work; ending their sessions is the caller's job. A new email replaces <c>Email</c> and <c>UserName</c> with their
    /// normalized forms and clears any pending address, in the same guarded update; another account holding it answers
    /// <see cref="EditOutcome.EmailTaken"/> and changes nothing.
    /// </summary>
    /// <param name="id">The account id.</param>
    /// <param name="change">The new values, already trimmed.</param>
    /// <param name="expectedVersion">The edit version the form was opened with.</param>
    /// <param name="cancellationToken">Cancels the update.</param>
    /// <returns>What happened, the version now stored, and the fields that really changed (see <see cref="EditedFields"/>).</returns>
    Task<DetailsEditResult> UpdateDetailsAsync(Guid id, UserDetailsChange change, Guid expectedVersion, CancellationToken cancellationToken);

    /// <summary>
    /// Sets, replaces or clears the new email awaiting confirmation (D-24). The sign-in email and the edit version do not
    /// change, so an open profile form stays current.
    /// </summary>
    /// <param name="id">The account id.</param>
    /// <param name="email">The new address, already trimmed; null clears it.</param>
    /// <param name="cancellationToken">Cancels the update.</param>
    /// <returns>A task that completes when the change is saved.</returns>
    Task SetPendingEmailAsync(Guid id, string? email, CancellationToken cancellationToken);

    /// <summary>
    /// Makes the pending email the sign-in email: <c>Email</c> and <c>UserName</c> with their normalized forms, clears the
    /// pending address, rotates the edit version and records the account itself as the last changer (PROF-02).
    /// </summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the update.</param>
    /// <returns>
    /// Whether it applied, found nothing pending, or found the address already held by another account (checked first,
    /// and again by the unique index). Nothing is written unless it applied.
    /// </returns>
    Task<EmailApplyOutcome> ApplyPendingEmailAsync(Guid id, CancellationToken cancellationToken);
}

/// <summary>What applying a pending email did.</summary>
public enum EmailApplyOutcome
{
    /// <summary>The pending address is now the sign-in email.</summary>
    Applied = 0,

    /// <summary>Another account holds the address, so nothing changed.</summary>
    Taken = 1,

    /// <summary>No change was pending, so nothing changed.</summary>
    NothingPending = 2,
}

/// <summary>What a versioned edit did.</summary>
public enum EditOutcome
{
    /// <summary>The change was saved and the version rotated.</summary>
    Saved = 0,

    /// <summary>The values already matched, so nothing was written and the version stayed.</summary>
    Unchanged = 1,

    /// <summary>The version was not the stored one, so nothing was written.</summary>
    Stale = 2,

    /// <summary>No such account.</summary>
    NotFound = 3,

    /// <summary>Another account already holds the new email, so nothing was written.</summary>
    EmailTaken = 4,
}

/// <summary>The result of a versioned edit.</summary>
/// <param name="Outcome">What happened.</param>
/// <param name="Version">The edit version now stored; empty when the account was not found.</param>
public readonly record struct EditResult(EditOutcome Outcome, Guid Version);

/// <summary>The new values of a Manager's edit of another person.</summary>
/// <param name="FirstName">The new given name, already trimmed.</param>
/// <param name="LastName">The new family name, already trimmed.</param>
/// <param name="Role">The new role (<c>Admin</c> or <c>Manager</c>); null leaves the role alone.</param>
/// <param name="Email">The new sign-in email, already trimmed; null leaves the email alone. The same address in another letter case is no change.</param>
public sealed record UserDetailsChange(string FirstName, string LastName, string? Role = null, string? Email = null);

/// <summary>The audit names of the fields a staff edit can change (field names only, D-40).</summary>
public static class EditedFields
{
    /// <summary>The given name.</summary>
    public const string FirstName = "first-name";

    /// <summary>The family name.</summary>
    public const string LastName = "last-name";

    /// <summary>The sign-in email.</summary>
    public const string Email = "email";

    /// <summary>The role.</summary>
    public const string Role = "role";
}

/// <summary>The result of <see cref="IUserAccounts.UpdateDetailsAsync"/>.</summary>
/// <param name="Outcome">What happened.</param>
/// <param name="Version">The edit version now stored; empty when the account was not found.</param>
/// <param name="ChangedFields">The fields that really changed, as <see cref="EditedFields"/> names; empty unless it saved.</param>
/// <param name="PreviousRole">The role the person held before, when the role changed; otherwise null.</param>
public sealed record DetailsEditResult(EditOutcome Outcome, Guid Version, IReadOnlyList<string> ChangedFields, string? PreviousRole = null)
{
    /// <summary>Gets the outcome and version as the plain edit result.</summary>
    public EditResult Edit => new(Outcome, Version);
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
