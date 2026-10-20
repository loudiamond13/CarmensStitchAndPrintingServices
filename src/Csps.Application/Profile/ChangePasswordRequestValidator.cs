using Csps.Domain.Identity;
using FluentValidation;

namespace Csps.Application.Profile;

/// <summary>
/// Checks the My Profile password form with the rules the browser also applies (OR-3): both fields are required and the
/// new password meets the length, control-character, number and symbol rules. The name, email and breach rules need the
/// account and run in the handler.
/// </summary>
public sealed class ChangePasswordRequestValidator : AbstractValidator<ChangePasswordRequest>
{
    /// <summary>The message for a missing current password.</summary>
    public const string CurrentPasswordRequired = "Enter your current password.";

    /// <summary>Creates the validator.</summary>
    public ChangePasswordRequestValidator()
    {
        RuleFor(request => request.CurrentPassword)
            .Must(static password => !string.IsNullOrEmpty(password)).WithMessage(CurrentPasswordRequired);

        RuleFor(request => request.NewPassword)
            .Custom(static (password, context) =>
            {
                var failure = string.IsNullOrEmpty(password) ? PasswordRuleFailure.Empty : PasswordPolicy.CheckComposition(password);
                if (failure is { } broken)
                {
                    context.AddFailure(PasswordPolicy.MessageFor(broken));
                }
            });
    }
}
