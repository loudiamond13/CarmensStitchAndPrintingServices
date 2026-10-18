using Csps.Application.Auth;
using FluentValidation;

namespace Csps.Application.Profile;

/// <summary>
/// Checks the change-email form with the rules the browser also applies (OR-3): the new email is required and shaped like
/// an address (the same rule as sign-in), and the current password is required. Rules that need the account run in the handler.
/// </summary>
public sealed class RequestEmailChangeRequestValidator : AbstractValidator<RequestEmailChangeRequest>
{
    /// <summary>The message for a missing new email.</summary>
    public const string NewEmailRequired = "Enter your new email.";

    /// <summary>Creates the validator.</summary>
    public RequestEmailChangeRequestValidator()
    {
        RuleFor(request => request.NewEmail)
            .Cascade(CascadeMode.Stop)
            .Must(static email => !string.IsNullOrWhiteSpace(email)).WithMessage(NewEmailRequired)
            .Must(static email => SignInRequestValidator.IsEmailShaped(email!.Trim())).WithMessage(SignInRequestValidator.EmailInvalid);

        RuleFor(request => request.CurrentPassword)
            .Must(static password => !string.IsNullOrEmpty(password)).WithMessage(ChangePasswordRequestValidator.CurrentPasswordRequired);
    }
}
