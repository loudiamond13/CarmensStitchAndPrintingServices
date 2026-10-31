namespace Csps.Application.Profile;

/// <summary>The My Profile change-email form: the new sign-in email and the current password (PROF-02).</summary>
/// <param name="NewEmail">The new address as typed.</param>
/// <param name="CurrentPassword">The current password as typed.</param>
public sealed record RequestEmailChangeRequest(string? NewEmail, string? CurrentPassword)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static RequestEmailChangeRequest Empty { get; } = new((string?)null, null);

    /// <summary>Returns the type name only, so an address or a password never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(RequestEmailChangeRequest);
}
