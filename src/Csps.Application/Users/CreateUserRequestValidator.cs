using Csps.Application.Auth;
using Csps.Application.Security;
using Csps.Domain.Identity;
using FluentValidation;

namespace Csps.Application.Users;

/// <summary>
/// Checks the Add User form with the rules the browser also applies (OR-3): both names required and at most 100 characters
/// after trim, the email required and shaped like an address, an explicit role and an explicit way to get access (D-15 is
/// only a preselection in the form), and, on the temporary-password route only, a password that meets the basic rule
/// (04 D-21: length, no control characters, a number, a symbol; no name or breach check). The unique-email rule needs the
/// database and runs in the handler.
/// </summary>
public sealed class CreateUserRequestValidator : AbstractValidator<CreateUserRequest>
{
    /// <summary>The message for a missing email.</summary>
    public const string EmailRequired = "Enter their email.";

    /// <summary>The message for a missing or unknown role.</summary>
    public const string RoleRequired = "Choose a role.";

    /// <summary>The message for a missing or unknown access choice.</summary>
    public const string AccessRequired = "Choose how they get access.";

    /// <summary>The message for a missing temporary password.</summary>
    public const string TemporaryPasswordRequired = "Enter a temporary password.";

    /// <summary>Creates the validator.</summary>
    public CreateUserRequestValidator()
    {
        RuleFor(request => request.FirstName)
            .Cascade(CascadeMode.Stop)
            .Must(static name => !string.IsNullOrWhiteSpace(name)).WithMessage(BootstrapManagerCommandValidator.FirstNameRequired)
            .Must(static name => name!.Trim().Length <= BootstrapManagerCommandValidator.NameMaxLength).WithMessage(BootstrapManagerCommandValidator.FirstNameTooLong);

        RuleFor(request => request.LastName)
            .Cascade(CascadeMode.Stop)
            .Must(static name => !string.IsNullOrWhiteSpace(name)).WithMessage(BootstrapManagerCommandValidator.LastNameRequired)
            .Must(static name => name!.Trim().Length <= BootstrapManagerCommandValidator.NameMaxLength).WithMessage(BootstrapManagerCommandValidator.LastNameTooLong);

        RuleFor(request => request.Email)
            .Cascade(CascadeMode.Stop)
            .Must(static email => !string.IsNullOrWhiteSpace(email)).WithMessage(EmailRequired)
            .Must(static email => SignInRequestValidator.IsEmailShaped(email!.Trim())).WithMessage(SignInRequestValidator.EmailInvalid);

        RuleFor(request => request.Role)
            .Must(static role => CanonicalRole(role) is not null).WithMessage(RoleRequired);

        RuleFor(request => request.Access)
            .Must(static access => CanonicalAccess(access) is not null).WithMessage(AccessRequired);

        // The password rule applies only when the Manager chose to hand one over; an invitation ignores any value sent with it.
        When(request => IsTemporaryPassword(request.Access), () =>
            RuleFor(request => request.TemporaryPassword)
                .Custom(static (password, context) =>
                {
                    var failure = string.IsNullOrEmpty(password) ? PasswordRuleFailure.Empty : PasswordPolicy.CheckComposition(password);
                    if (failure is { } broken)
                    {
                        context.AddFailure(broken == PasswordRuleFailure.Empty ? TemporaryPasswordRequired : PasswordPolicy.MessageFor(broken));
                    }
                }));
    }

    /// <summary>Maps the role text of the form to the role name, in any letter case.</summary>
    /// <param name="role">The text sent.</param>
    /// <returns><see cref="Roles.Admin"/> or <see cref="Roles.Manager"/>; null when it is neither.</returns>
    internal static string? CanonicalRole(string? role) => role?.Trim() switch
    {
        { } text when string.Equals(text, Roles.Admin, StringComparison.OrdinalIgnoreCase) => Roles.Admin,
        { } text when string.Equals(text, Roles.Manager, StringComparison.OrdinalIgnoreCase) => Roles.Manager,
        _ => null,
    };

    /// <summary>Maps the access text of the form to its canonical value, in any letter case.</summary>
    /// <param name="access">The text sent.</param>
    /// <returns><see cref="CreateUserRequest.InvitationAccess"/> or <see cref="CreateUserRequest.TemporaryPasswordAccess"/>; null when it is neither.</returns>
    internal static string? CanonicalAccess(string? access) => access?.Trim() switch
    {
        { } text when string.Equals(text, CreateUserRequest.InvitationAccess, StringComparison.OrdinalIgnoreCase) => CreateUserRequest.InvitationAccess,
        { } text when string.Equals(text, CreateUserRequest.TemporaryPasswordAccess, StringComparison.OrdinalIgnoreCase) => CreateUserRequest.TemporaryPasswordAccess,
        _ => null,
    };

    private static bool IsTemporaryPassword(string? access) => CanonicalAccess(access) == CreateUserRequest.TemporaryPasswordAccess;
}
