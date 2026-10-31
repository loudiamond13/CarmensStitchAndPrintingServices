using Csps.Domain.Identity;

namespace Csps.Application.Auth;

/// <summary>A staff account as the auth handlers see it. It never carries a hash, a stamp or an Identity type.</summary>
/// <param name="Id">The account id.</param>
/// <param name="Email">The sign-in email, as stored.</param>
/// <param name="FirstName">Given name.</param>
/// <param name="LastName">Family name.</param>
/// <param name="Role">The single role, <c>Admin</c> or <c>Manager</c>; empty when none is assigned.</param>
/// <param name="IsActive">False once the account is deactivated.</param>
/// <param name="EmailConfirmed">True once the address is confirmed; only confirmed accounts may sign in.</param>
/// <param name="HasPassword">False for an account created without a password.</param>
/// <param name="MustChangePassword">Why the next sign-in must end with a new password (D-13), or null.</param>
/// <param name="BreachRecheckPending">True when the password is to be checked against the breach list (D-14).</param>
/// <param name="LockoutEnd">When the lockout ends; null or a past time means not locked.</param>
/// <param name="IsManagerLocked">True while a Manager's lock is on the account (D-16).</param>
/// <param name="IsDeleted">True once the account is soft-deleted (D-07).</param>
public sealed record UserAccount(
    Guid Id,
    string Email,
    string FirstName,
    string LastName,
    string Role,
    bool IsActive,
    bool EmailConfirmed,
    bool HasPassword,
    PasswordChangeReason? MustChangePassword,
    bool BreachRecheckPending,
    DateTimeOffset? LockoutEnd,
    bool IsManagerLocked = false,
    bool IsDeleted = false)
{
    /// <summary>True when the account is deactivated, deleted or Manager-locked. The timed failed-password lockout is separate and is not a block.</summary>
    public bool IsBlocked => !IsActive || IsManagerLocked || IsDeleted;

    /// <summary>Prints the type name only, so a log or debugger never shows the address or names.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(UserAccount);
}

/// <summary>The details needed to create a staff account.</summary>
/// <param name="Email">The sign-in email.</param>
/// <param name="FirstName">Given name.</param>
/// <param name="LastName">Family name.</param>
/// <param name="Role">The role to assign, <c>Admin</c> or <c>Manager</c>.</param>
/// <param name="Password">The first password, or null for an account that sets it later. A given password is stored NFC-normalized and marks the email confirmed, unless <paramref name="KeepEmailUnconfirmed"/> is set.</param>
/// <param name="KeepEmailUnconfirmed">True for a Manager-set temporary password: the email stays unconfirmed until the first correct sign-in code (D-49).</param>
public sealed record NewUserAccount(string Email, string FirstName, string LastName, string Role, string? Password, bool KeepEmailUnconfirmed = false);
