namespace Csps.Application.Profile;

/// <summary>The My Profile password form: the current password and the new one (PROF-03).</summary>
/// <param name="CurrentPassword">The current password as typed.</param>
/// <param name="NewPassword">The new password as typed.</param>
public sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static ChangePasswordRequest Empty { get; } = new((string?)null, null);

    /// <summary>Returns the type name only, so a password never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(ChangePasswordRequest);
}
