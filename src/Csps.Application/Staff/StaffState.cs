using Csps.Application.Security;

namespace Csps.Application.Staff;

/// <summary>One person's role and account flags, read for the payer rule (D-32). Never carries an email address.</summary>
/// <param name="Id">The account id.</param>
/// <param name="Name">The first and last name as saved, joined by one space.</param>
/// <param name="Role">The single role name; null when the account has none.</param>
/// <param name="IsActive">False once the account is deactivated.</param>
/// <param name="IsManagerLocked">True while a Manager has locked the account.</param>
/// <param name="IsDeleted">True once the account is soft-deleted.</param>
/// <param name="HasPassword">True once the person has a password (an invited person who has not set one does not).</param>
public sealed record StaffState(Guid Id, string Name, string? Role, bool IsActive, bool IsManagerLocked, bool IsDeleted, bool HasPassword)
{
    /// <summary>The single payer rule (D-32): an Admin or Manager who is active, not locked, not deleted and has a password.</summary>
    public bool CanPay =>
        Role is Roles.Admin or Roles.Manager && IsActive && !IsManagerLocked && !IsDeleted && HasPassword;

    /// <summary>True only for the Manager role.</summary>
    public bool IsManager => Role == Roles.Manager;
}
