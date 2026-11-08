namespace Csps.Application.Money;

/// <summary>An Admin or Manager account and its status, as the recipients list reads it. It never carries an address or a figure.</summary>
/// <param name="Id">The account id.</param>
/// <param name="Name">The first and last name, joined by one space.</param>
/// <param name="IsActive">False once the account is deactivated.</param>
/// <param name="IsDeleted">True once the account is soft-deleted.</param>
public sealed record StaffPerson(Guid Id, string Name, bool IsActive, bool IsDeleted)
{
    /// <summary>Gets the account's staff role, <c>Admin</c> or <c>Manager</c>; empty when the reader did not fill it.</summary>
    public string Role { get; init; } = string.Empty;
}
