namespace Csps.Application.Auth;

/// <summary>The forgot-password form: the email the reset link goes to (D-16).</summary>
/// <param name="Email">The email address.</param>
public sealed record ForgotPasswordRequest(string? Email)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports the missing field.</summary>
    public static ForgotPasswordRequest Empty { get; } = new((string?)null);

    /// <summary>Returns the type name only, so an email never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(ForgotPasswordRequest);
}
