using Csps.Application.Auth;
using FluentValidation;

namespace Csps.Application.Profile;

/// <summary>
/// Checks the change-email form with the rules the browser also applies (OR-3): the new email is required and shaped like
/// an address (the same rule as sign-in) and not the caller's current one, and the current password is required. The handler passes the
/// current email in through the validation context under <see cref="CurrentEmailKey"/>; the rule that needs the database runs there.
/// </summary>
public sealed class RequestEmailChangeRequestValidator : AbstractValidator<RequestEmailChangeRequest>
{
    /// <summary>The message for a missing new email.</summary>
    public const string NewEmailRequired = "Enter your new email.";

    /// <summary>The message for the caller's own current address.</summary>
    public const string SameEmail = "This is already your email.";

    /// <summary>The validation-context key the handler stores the caller's current email under.</summary>
    public const string CurrentEmailKey = "currentEmail";

    /// <summary>Creates the validator.</summary>
    public RequestEmailChangeRequestValidator()
    {
        RuleFor(request => request.NewEmail)
            .Cascade(CascadeMode.Stop)
            .Must(static email => !string.IsNullOrWhiteSpace(email)).WithMessage(NewEmailRequired)
            .Must(static email => SignInRequestValidator.IsEmailShaped(email!.Trim())).WithMessage(SignInRequestValidator.EmailInvalid)
            .Must(static (_, email, context) => !IsCurrentEmail(email!, context)).WithMessage(SameEmail);

        RuleFor(request => request.CurrentPassword)
            .Must(static password => !string.IsNullOrEmpty(password)).WithMessage(ChangePasswordRequestValidator.CurrentPasswordRequired);
    }

    private static bool IsCurrentEmail(string email, ValidationContext<RequestEmailChangeRequest> context) =>
        context.RootContextData.TryGetValue(CurrentEmailKey, out var current)
        && string.Equals(email.Trim(), current as string, StringComparison.OrdinalIgnoreCase);
}
