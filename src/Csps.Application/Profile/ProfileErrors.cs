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

    /// <summary>Gets the answer for a wrong current password: a 400 on the current-password field.</summary>
    public static Error WrongPassword { get; } = Error.Validation(
        AuthErrors.ValidationCode,
        AuthErrors.ValidationMessage,
        new Dictionary<string, string[]> { [CurrentPasswordField] = [WrongPasswordMessage] });
}
