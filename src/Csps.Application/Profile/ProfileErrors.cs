using Csps.Application.Auth;
using Csps.Domain.Common;

namespace Csps.Application.Profile;

/// <summary>The error values the My Profile use cases return.</summary>
public static class ProfileErrors
{
    /// <summary>The field that current-password errors belong to.</summary>
    public const string CurrentPasswordField = "currentPassword";

    /// <summary>The text under the current-password field when it does not match (D-46).</summary>
    public const string WrongPasswordMessage = "Your current password is incorrect.";

    /// <summary>The code of a password change refused because the account is locked after too many wrong passwords (D-41 Q9).</summary>
    public const string PasswordLockedCode = "profile.password-locked";

    /// <summary>The plain-English text for a locked account.</summary>
    public const string PasswordLockedMessage = "Too many wrong passwords. Try again in 15 minutes.";

    /// <summary>Returns the answer for a locked account: a 429 that carries the wait.</summary>
    /// <param name="retryAfter">How long is left of the lock; a wait of zero or less is raised to one second.</param>
    /// <returns>The error.</returns>
    public static Error PasswordLocked(TimeSpan retryAfter) =>
        Error.TooManyRequests(PasswordLockedCode, PasswordLockedMessage, retryAfter > TimeSpan.Zero ? retryAfter : TimeSpan.FromSeconds(1));

    /// <summary>Gets the answer for a wrong current password: a 400 on the current-password field.</summary>
    public static Error WrongPassword { get; } = Error.Validation(
        AuthErrors.ValidationCode,
        AuthErrors.ValidationMessage,
        new Dictionary<string, string[]> { [CurrentPasswordField] = [WrongPasswordMessage] });
}
