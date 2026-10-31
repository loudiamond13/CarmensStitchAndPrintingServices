using FluentValidation;

namespace Csps.Application.Auth;

/// <summary>
/// Checks the accept-invite form. Only a missing password is a field error here: the full rule runs in
/// <see cref="PasswordRules"/> so its messages match the browser, and a missing token reads as an invalid invite.
/// </summary>
public sealed class AcceptInviteRequestValidator : AbstractValidator<AcceptInviteRequest>
{
    /// <summary>Creates the validator.</summary>
    public AcceptInviteRequestValidator()
    {
        RuleFor(request => request.NewPassword)
            .Must(static password => !string.IsNullOrEmpty(password)).WithMessage(PasswordRules.NewPasswordRequired);
    }
}
