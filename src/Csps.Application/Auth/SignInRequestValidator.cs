using FluentValidation;

namespace Csps.Application.Auth;

/// <summary>
/// Checks the sign-in form with the UI-SPEC messages. The password gets no length or composition rule, because legacy
/// and temporary passwords must still be accepted. The email check uses no regular expression (CWE-1333).
/// </summary>
public sealed class SignInRequestValidator : AbstractValidator<SignInRequest>
{
    /// <summary>The longest accepted email address.</summary>
    public const int EmailMaxLength = 256;

    /// <summary>The message for a missing email.</summary>
    public const string EmailRequired = "Enter your email.";

    /// <summary>The message for a malformed email.</summary>
    public const string EmailInvalid = "Enter a valid email, like name@gmail.com";

    /// <summary>The message for a missing password.</summary>
    public const string PasswordRequired = "Enter your password.";

    /// <summary>Creates the validator.</summary>
    public SignInRequestValidator()
    {
        RuleFor(request => request.Email)
            .Cascade(CascadeMode.Stop)
            .Must(static email => !string.IsNullOrWhiteSpace(email)).WithMessage(EmailRequired)
            .Must(static email => IsEmailShaped(email!.Trim())).WithMessage(EmailInvalid);

        RuleFor(request => request.Password)
            .Must(static password => !string.IsNullOrEmpty(password)).WithMessage(PasswordRequired);
    }

    // One '@' with text on both sides, within the length cap.
    private static bool IsEmailShaped(string email)
    {
        if (email.Length > EmailMaxLength)
        {
            return false;
        }

        var at = email.IndexOf('@', StringComparison.Ordinal);
        return at > 0 && at < email.Length - 1 && email.IndexOf('@', at + 1) < 0;
    }
}
