namespace Csps.Application.Users;

/// <summary>
/// The Add User form (USER-02, C-4): who the person is, their role, and how they get access. Any other member in the
/// body, such as a forged <c>createdById</c>, is ignored; who created the account comes from the token (SEC-08).
/// </summary>
/// <param name="FirstName">Given name.</param>
/// <param name="LastName">Family name.</param>
/// <param name="Email">The sign-in email.</param>
/// <param name="Role">The role, <c>Admin</c> or <c>Manager</c>.</param>
/// <param name="Access">How they get access: <c>invitation</c> or <c>temporary-password</c>.</param>
/// <param name="TemporaryPassword">The one-time password, only for the <c>temporary-password</c> route.</param>
public sealed record CreateUserRequest(string? FirstName, string? LastName, string? Email, string? Role, string? Access, string? TemporaryPassword)
{
    /// <summary>The <see cref="Access"/> value that emails a 7-day invitation link (D-12, D-13).</summary>
    public const string InvitationAccess = "invitation";

    /// <summary>The <see cref="Access"/> value that sets a temporary password the person must replace (C-4).</summary>
    public const string TemporaryPasswordAccess = "temporary-password";

    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static CreateUserRequest Empty { get; } = new(null, null, null, null, null, null);

    /// <summary>Returns the type name only, so a temporary password never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(CreateUserRequest);
}
