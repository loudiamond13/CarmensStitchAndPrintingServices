using FluentValidation;

namespace Csps.Application.Profile;

/// <summary>
/// Checks the name form. Length is counted in UTF-16 code units after trimming, the same measure as a browser string
/// length, so the web form and the server agree.
/// </summary>
public sealed class UpdateProfileNameRequestValidator : AbstractValidator<UpdateProfileNameRequest>
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

    /// <summary>The message for a missing or malformed version.</summary>
    public const string VersionInvalid = "Reload the form and try again.";

    /// <summary>Creates the validator.</summary>
    public UpdateProfileNameRequestValidator()
    {
        RuleFor(request => request.FirstName)
            .Cascade(CascadeMode.Stop)
            .Must(static name => !string.IsNullOrWhiteSpace(name)).WithMessage(FirstNameRequired)
            .Must(static name => name!.Trim().Length <= NameMaxLength).WithMessage(FirstNameTooLong);

        RuleFor(request => request.LastName)
            .Cascade(CascadeMode.Stop)
            .Must(static name => !string.IsNullOrWhiteSpace(name)).WithMessage(LastNameRequired)
            .Must(static name => name!.Trim().Length <= NameMaxLength).WithMessage(LastNameTooLong);

        RuleFor(request => request.Version)
            .Must(static version => TryParseVersion(version, out _)).WithMessage(VersionInvalid);
    }

    /// <summary>Reads a version in canonical <c>D</c> form.</summary>
    /// <param name="version">The text sent by the form.</param>
    /// <param name="parsed">The version when it is well formed.</param>
    /// <returns>True when the text is a GUID in <c>D</c> form.</returns>
    public static bool TryParseVersion(string? version, out Guid parsed)
    {
        parsed = Guid.Empty;
        return version is not null && Guid.TryParseExact(version, "D", out parsed);
    }
}
