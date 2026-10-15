using FluentValidation;

namespace Csps.Application.Auth;

/// <summary>
/// Checks the must-change form. Only a missing password is a field error here: the full rule runs in
/// <see cref="PasswordRules"/> so its messages match the browser.
/// </summary>
public sealed class SetNewPasswordRequestValidator : AbstractValidator<SetNewPasswordRequest>
{
    /// <summary>Shown when the new password is empty.</summary>
    public const string NewPasswordRequired = "Enter a new password.";

    /// <summary>Creates the validator.</summary>
    public SetNewPasswordRequestValidator()
    {
        RuleFor(request => request.NewPassword)
            .Must(static password => !string.IsNullOrEmpty(password)).WithMessage(NewPasswordRequired);
    }
}
