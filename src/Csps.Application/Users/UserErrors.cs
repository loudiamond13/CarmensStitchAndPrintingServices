using Csps.Application.Auth;
using Csps.Domain.Common;

namespace Csps.Application.Users;

/// <summary>The error values the staff account use cases return.</summary>
public static class UserErrors
{
    /// <summary>The code of a bootstrap refused because an active Manager exists.</summary>
    public const string ManagerExistsCode = "bootstrap.manager-exists";

    /// <summary>The plain-English text of a bootstrap refused because an active Manager exists.</summary>
    public const string ManagerExistsMessage = "An active Manager already exists, so the first Manager cannot be created.";

    /// <summary>The code of a bootstrap whose email already belongs to an account.</summary>
    public const string EmailTakenCode = "bootstrap.email-taken";

    /// <summary>The plain-English text of a bootstrap whose email already belongs to an account.</summary>
    public const string EmailTakenMessage = "An account with that email already exists.";

    /// <summary>The code of a person who does not exist or was deleted (D-09).</summary>
    public const string NotFoundCode = "users.not-found";

    /// <summary>The plain-English text for a person who does not exist or was deleted.</summary>
    public const string NotFoundMessage = "This user was deleted.";

    /// <summary>The form field that a taken email belongs to.</summary>
    public const string EmailInUseField = "email";

    /// <summary>The plain-English text under the email field when another account already uses the address.</summary>
    public const string EmailInUseMessage = "Another account already uses this email.";

    /// <summary>Gets the answer for a bootstrap while an active Manager exists.</summary>
    public static Error ManagerExists { get; } = Error.BusinessRule(ManagerExistsCode, ManagerExistsMessage);

    /// <summary>Gets the answer for a bootstrap with an email that is already in use.</summary>
    public static Error EmailTaken { get; } = Error.BusinessRule(EmailTakenCode, EmailTakenMessage);

    /// <summary>Gets the answer for a person who does not exist or was deleted: a 404 with the same words for both.</summary>
    public static Error NotFound { get; } = Error.NotFound(NotFoundCode, NotFoundMessage);

    /// <summary>Gets the answer for creating a person whose email another account already uses: a 400 on the email field.</summary>
    public static Error EmailInUse { get; } = Error.Validation(
        AuthErrors.ValidationCode,
        AuthErrors.ValidationMessage,
        new Dictionary<string, string[]> { [EmailInUseField] = [EmailInUseMessage] });
}
