namespace Csps.Application.Auth;

/// <summary>The reset form: the token from the emailed link and the new password (AUTH-09).</summary>
/// <param name="Token">The 43-character token from the link.</param>
/// <param name="NewPassword">The new password as typed.</param>
public sealed record ResetPasswordRequest(string? Token, string? NewPassword)
{
    /// <summary>Gets the request used when the body is empty or unreadable.</summary>
    public static ResetPasswordRequest Empty { get; } = new(null, null);

    /// <summary>Returns the type name only, so a token or password never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(ResetPasswordRequest);
}
