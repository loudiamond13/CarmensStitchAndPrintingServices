namespace Csps.Application.Users;

/// <summary>
/// The Edit User form a Manager saves for another person: the names, the sign-in email, the role and the edit version the form was
/// opened with (SEC-07). When the email differs from the stored one, <c>emailChange</c> says how the change applies (D-45).
/// </summary>
/// <param name="FirstName">Given name.</param>
/// <param name="LastName">Family name.</param>
/// <param name="Role"><c>Admin</c> or <c>Manager</c>, in any letter case.</param>
/// <param name="Version">The edit version as a GUID in <c>D</c> form.</param>
/// <param name="Email">The sign-in email the person should have; send the stored one to leave it alone.</param>
/// <param name="EmailChange">
/// How a changed email applies: <c>confirm</c> (a link to the new address, the change applies when it is followed) or <c>now</c> (the
/// email changes at once and the person is signed out). The server never infers it. It is ignored when the email is unchanged, and an
/// invited person with no password yet always moves at once.
/// </param>
public sealed record UpdateUserRequest(string? FirstName, string? LastName, string? Role, string? Version, string? Email = null, string? EmailChange = null)
{
    /// <summary>The <see cref="EmailChange"/> value that sends a confirmation link and applies the change when it is followed.</summary>
    public const string ConfirmByLink = "confirm";

    /// <summary>The <see cref="EmailChange"/> value that changes the email at once.</summary>
    public const string SaveAtOnce = "now";

    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static UpdateUserRequest Empty { get; } = new(null, null, null, null);
}
