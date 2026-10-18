namespace Csps.Application.Users;

/// <summary>The Edit User form a Manager saves for another person: the names, the role and the edit version the form was opened with (SEC-07).</summary>
/// <param name="FirstName">Given name.</param>
/// <param name="LastName">Family name.</param>
/// <param name="Role"><c>Admin</c> or <c>Manager</c>, in any letter case.</param>
/// <param name="Version">The edit version as a GUID in <c>D</c> form.</param>
public sealed record UpdateUserRequest(string? FirstName, string? LastName, string? Role, string? Version)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static UpdateUserRequest Empty { get; } = new(null, null, null, null);
}
