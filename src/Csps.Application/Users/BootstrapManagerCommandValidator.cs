using Csps.Application.Auth;
using FluentValidation;

namespace Csps.Application.Users;

/// <summary>Checks the bootstrap details: the sign-in email rule, and a first and last name of at most 100 characters.</summary>
public sealed class BootstrapManagerCommandValidator : AbstractValidator<BootstrapManagerCommand>
{
    /// <summary>The longest accepted name.</summary>
    public const int NameMaxLength = 100;

    /// <summary>The message for a missing first name.</summary>
    public const string FirstNameRequired = "Enter a first name.";

    /// <summary>The message for a missing last name.</summary>
    public const string LastNameRequired = "Enter a last name.";

    /// <summary>The message for a first name over the limit.</summary>
    public const string FirstNameTooLong = "First name must be 100 characters or fewer.";

    /// <summary>The message for a last name over the limit.</summary>
    public const string LastNameTooLong = "Last name must be 100 characters or fewer.";

    /// <summary>Creates the validator.</summary>
    public BootstrapManagerCommandValidator()
    {
        RuleFor(command => command.Email)
            .Cascade(CascadeMode.Stop)
            .Must(static email => !string.IsNullOrWhiteSpace(email)).WithMessage(SignInRequestValidator.EmailRequired)
            .Must(static email => SignInRequestValidator.IsEmailShaped(email!.Trim())).WithMessage(SignInRequestValidator.EmailInvalid);

        RuleFor(command => command.FirstName)
            .Cascade(CascadeMode.Stop)
            .Must(static name => !string.IsNullOrWhiteSpace(name)).WithMessage(FirstNameRequired)
            .Must(static name => name!.Trim().Length <= NameMaxLength).WithMessage(FirstNameTooLong);

        RuleFor(command => command.LastName)
            .Cascade(CascadeMode.Stop)
            .Must(static name => !string.IsNullOrWhiteSpace(name)).WithMessage(LastNameRequired)
            .Must(static name => name!.Trim().Length <= NameMaxLength).WithMessage(LastNameTooLong);
    }
}
