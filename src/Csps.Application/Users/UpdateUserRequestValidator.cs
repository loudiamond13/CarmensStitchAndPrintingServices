using Csps.Application.Auth;
using Csps.Application.Profile;
using FluentValidation;

namespace Csps.Application.Users;

/// <summary>
/// Checks the Edit User form with the rules the browser also applies (OR-3): the same name and version rules as My Profile, an
/// explicit role and a required email shaped like an address (the sign-in rule). Whether the email is taken, and whether the way it
/// applies was chosen, need the stored person and are checked in the handler.
/// </summary>
public sealed class UpdateUserRequestValidator : AbstractValidator<UpdateUserRequest>
{
    /// <summary>Creates the validator.</summary>
    public UpdateUserRequestValidator()
    {
        RuleFor(request => request.FirstName)
            .Cascade(CascadeMode.Stop)
            .Must(static name => !string.IsNullOrWhiteSpace(name)).WithMessage(UpdateProfileNameRequestValidator.FirstNameRequired)
            .Must(static name => name!.Trim().Length <= UpdateProfileNameRequestValidator.NameMaxLength).WithMessage(UpdateProfileNameRequestValidator.FirstNameTooLong);

        RuleFor(request => request.LastName)
            .Cascade(CascadeMode.Stop)
            .Must(static name => !string.IsNullOrWhiteSpace(name)).WithMessage(UpdateProfileNameRequestValidator.LastNameRequired)
            .Must(static name => name!.Trim().Length <= UpdateProfileNameRequestValidator.NameMaxLength).WithMessage(UpdateProfileNameRequestValidator.LastNameTooLong);

        RuleFor(request => request.Email)
            .Must(static email => !string.IsNullOrWhiteSpace(email) && SignInRequestValidator.IsEmailShaped(email.Trim()))
            .WithMessage(SignInRequestValidator.EmailInvalid);

        RuleFor(request => request.Role)
            .Must(static role => CreateUserRequestValidator.CanonicalRole(role) is not null).WithMessage(CreateUserRequestValidator.RoleRequired);

        RuleFor(request => request.Version)
            .Must(static version => UpdateProfileNameRequestValidator.TryParseVersion(version, out _)).WithMessage(UpdateProfileNameRequestValidator.VersionInvalid);
    }
}
