using FluentValidation;

namespace Csps.Application.Auth;

/// <summary>Checks the forgot-password form with the same email rule and messages as sign-in (UI-SPEC S1).</summary>
public sealed class ForgotPasswordRequestValidator : AbstractValidator<ForgotPasswordRequest>
{
    /// <summary>Creates the validator.</summary>
    public ForgotPasswordRequestValidator()
    {
        RuleFor(request => request.Email)
            .Cascade(CascadeMode.Stop)
            .Must(static email => !string.IsNullOrWhiteSpace(email)).WithMessage(SignInRequestValidator.EmailRequired)
            .Must(static email => SignInRequestValidator.IsEmailShaped(email!.Trim())).WithMessage(SignInRequestValidator.EmailInvalid);
    }
}
