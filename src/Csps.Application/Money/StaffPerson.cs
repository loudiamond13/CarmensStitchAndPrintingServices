namespace Csps.Application.Money;

/// <summary>An Admin or Manager account and its flags, as the recipients list reads it. It never carries an address or a figure.</summary>
/// <param name="Id">The account id.</param>
/// <param name="Name">The first and last name, joined by one space.</param>
/// <param name="Role">The role name, <c>Admin</c> or <c>Manager</c>.</param>
/// <param name="IsActive">False once the account is deactivated.</param>
/// <param name="IsManagerLocked">True while a Manager has locked the account.</param>
/// <param name="IsDeleted">True once the account is soft-deleted.</param>
public sealed record StaffPerson(Guid Id, string Name, string Role, bool IsActive, bool IsManagerLocked, bool IsDeleted);
