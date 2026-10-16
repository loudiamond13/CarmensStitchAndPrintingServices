using FluentValidation;

namespace Csps.Application.Auth;

/// <summary>
/// Checks the reset form. Only a missing password is a field error here: the full rule runs in <see cref="PasswordRules"/>
/// so its messages match the browser, and a missing token reads as an invalid link.
/// </summary>
public sealed class ResetPasswordRequestValidator : AbstractValidator<ResetPasswordRequest>
{
    /// <summary>Shown when the new password is empty.</summary>
    public const string NewPasswordRequired = "Enter a new password.";

    /// <summary>Creates the validator.</summary>
    public ResetPasswordRequestValidator()
    {
        RuleFor(request => request.NewPassword)
            .Must(static password => !string.IsNullOrEmpty(password)).WithMessage(NewPasswordRequired);
    }
}
